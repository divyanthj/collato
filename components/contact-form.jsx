
"use client";

import { useState } from "react";
import { AlertBanner } from "@/components/alert-banner";

const initialFormState = {
  name: "",
  email: "",
  message: "",
};

export function ContactForm() {
  const [form, setForm] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const updateField = (field) => (event) => {
    setForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not send your message.");
      }

      setSuccessMessage("Thanks. Your message has been sent.");
      setForm(initialFormState);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not send your message.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <label className="form-control">
        <div className="label pb-2">
          <span className="label-text">Name</span>
        </div>
        <input
          type="text"
          className="input input-bordered"
          value={form.name}
          onChange={updateField("name")}
          maxLength={120}
          required
        />
      </label>

      <label className="form-control">
        <div className="label pb-2">
          <span className="label-text">Email</span>
        </div>
        <input
          type="email"
          className="input input-bordered"
          value={form.email}
          onChange={updateField("email")}
          maxLength={200}
          required
        />
      </label>

      <label className="form-control">
        <div className="label pb-2">
          <span className="label-text">Message</span>
        </div>
        <textarea
          className="textarea textarea-bordered min-h-40"
          value={form.message}
          onChange={updateField("message")}
          maxLength={5000}
          required
        />
      </label>

      {successMessage ? <AlertBanner tone="success">{successMessage}</AlertBanner> : null}
      {errorMessage ? <AlertBanner tone="error">{errorMessage}</AlertBanner> : null}

      <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}
