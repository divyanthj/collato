import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { sendResendEmail } from "@/lib/resend";

const defaultNotificationEmail = "divyanthj@gmail.com";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const message = String(body?.message ?? "").trim();

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email, and message are required" }, { status: 400 });
  }

  if (name.length > 120) {
    return NextResponse.json({ error: "Name is too long" }, { status: 400 });
  }

  if (email.length > 200 || !isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }

  if (message.length > 5000) {
    return NextResponse.json({ error: "Message is too long" }, { status: 400 });
  }

  const database = await getDatabase();
  const contactSubmissions = database.collection("contact_submissions");

  const submission = {
    name,
    email,
    message,
    source: "contact-form",
    createdAt: new Date(),
  };

  const saveResult = await contactSubmissions.insertOne(submission);

  const notificationEmail = (process.env.CONTACT_NOTIFICATION_EMAIL ?? defaultNotificationEmail).trim();
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replaceAll("\n", "<br />");

  try {
    await sendResendEmail({
      to: notificationEmail,
      replyTo: email,
      subject: `New Collato contact form message from ${name}`,
      html: `
        <h2>New contact form message</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
      `,
      text: `New contact form message\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      tags: [
        { name: "flow", value: "contact-form" },
        { name: "app", value: "collato" },
      ],
    });

    await sendResendEmail({
      to: email,
      subject: "We received your message",
      html: `
        <h2>Thanks for contacting Collato.io</h2>
        <p>Hi ${safeName},</p>
        <p>We have received your message and will get back to you shortly.</p>
        <p><strong>Your message:</strong></p>
        <p>${safeMessage}</p>
      `,
      text: `Hi ${name},\n\nWe have received your message and will get back to you shortly.\n\nYour message:\n${message}`,
      tags: [
        { name: "flow", value: "contact-form-ack" },
        { name: "app", value: "collato" },
      ],
    });
  } catch (error) {
    await contactSubmissions.updateOne(
      { _id: saveResult.insertedId },
      { $set: { notificationFailedAt: new Date(), notificationError: error instanceof Error ? error.message : "unknown_error" } }
    );

    return NextResponse.json(
      { error: "Message saved, but notification email failed. Please try again shortly." },
      { status: 500 }
    );
  }

  await contactSubmissions.updateOne(
    { _id: saveResult.insertedId },
    { $set: { notificationSentAt: new Date(), notificationEmail, senderAcknowledgementSentAt: new Date() } }
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
