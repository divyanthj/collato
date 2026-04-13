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
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;background-color:#f4fbff;margin:0;padding:0;">
          <tr>
            <td align="center" style="padding:24px 12px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;border-collapse:separate;background-color:#ffffff;border:1px solid #d9e7f2;border-radius:16px;">
                <tr>
                  <td style="padding:24px;font-family:Arial,sans-serif;color:#18324a;">
                    <h2 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#18324a;">New contact form message</h2>
                    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;"><strong>Name:</strong> ${safeName}</p>
                    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;"><strong>Email:</strong> ${safeEmail}</p>
                    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;"><strong>Message:</strong></p>
                    <p style="margin:0;font-size:15px;line-height:1.7;color:#385065;white-space:normal;">${safeMessage}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
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
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;background-color:#f4fbff;margin:0;padding:0;">
          <tr>
            <td align="center" style="padding:24px 12px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;border-collapse:separate;background-color:#ffffff;border:1px solid #d9e7f2;border-radius:16px;">
                <tr>
                  <td style="padding:24px;font-family:Arial,sans-serif;color:#18324a;">
                    <h2 style="margin:0 0 14px;font-size:24px;line-height:1.2;color:#18324a;">Thanks for contacting Collato.io</h2>
                    <p style="margin:0 0 10px;font-size:15px;line-height:1.7;color:#385065;">Hi ${safeName},</p>
                    <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#385065;">We have received your message and will get back to you shortly.</p>
                    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;"><strong>Your message:</strong></p>
                    <p style="margin:0;font-size:15px;line-height:1.7;color:#385065;white-space:normal;">${safeMessage}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
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
