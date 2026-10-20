"use client";

import { useState } from "react";
import { ArrowRight, CircleHelp, LockKeyhole, X } from "lucide-react";
import { useLanguage } from "@/components/i18n-provider";
import { useConfirm } from "@/components/confirm-provider";

type Props = {
  onClose: () => void;
  onSwitchToLogin: () => void;
};

export default function ForgotPasswordModal({ onClose, onSwitchToLogin }: Props) {
  const { t } = useLanguage();
  const confirm = useConfirm();
  const [step, setStep] = useState<"identify" | "answer" | "done" | "emailSent">("identify");
  const [identifier, setIdentifier] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [error, setError] = useState("");

  const lookUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!identifier.trim()) return setError("Enter your email or username.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "getSecurityQuestion", identifier: identifier.trim() }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Could not find a security question for that account.");
      setQuestion(result.question);
      setStep("answer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendEmailLink = async () => {
    setError("");
    if (!identifier.trim()) return setError("Enter your email or username.");
    setEmailSending(true);
    try {
      const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "requestPasswordReset", identifier: identifier.trim() }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Something went wrong.");
      setStep("emailSent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setEmailSending(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!answer.trim()) return setError("Enter your answer.");
    if (newPassword.length < 8) return setError("New password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");
    if (!(await confirm({ title: "Reset your password?", message: "You'll need this new password the next time you sign in." }))) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resetPasswordWithSecurityAnswer", identifier: identifier.trim(), answer, newPassword }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "That answer doesn't match our records.");
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="auth-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="modal-brand"><div className="brand-icon"><CircleHelp size={20} strokeWidth={3} /></div>{t("Reset password")}</div>
        {step === "identify" && <>
          <h2>{t("Forgot your password?")}</h2>
          <p>{t("Enter your email or username and we'll ask your security question.")}</p>
          <form onSubmit={lookUp}>
            <label className="input-label">{t("Email or username")}</label>
            <input className="text-input" placeholder="you@example.com or username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
            {error && <p className="form-error-text">{error}</p>}
            <button className="primary-btn full-btn" disabled={submitting}>{submitting ? t("Looking up...") : t("Continue")}<ArrowRight size={17} /></button>
          </form>
          <div className="modal-switch"><button type="button" disabled={emailSending} onClick={sendEmailLink}>{emailSending ? t("Sending...") : t("Email me a reset link instead")}</button></div>
        </>}
        {step === "emailSent" && <>
          <h2>{t("Check your email")}</h2>
          <p>{t("If an account with an email on file matches that, we've sent a password reset link. Check your inbox (and spam folder) - the link expires in 30 minutes.")}</p>
          <button className="primary-btn full-btn" onClick={onSwitchToLogin}>{t("Back to sign in")}<ArrowRight size={17} /></button>
        </>}
        {step === "answer" && <>
          <h2>{t("Answer your security question")}</h2>
          <p>{question}</p>
          <form onSubmit={reset}>
            <label className="input-label">{t("Your answer")}</label>
            <input className="text-input" value={answer} onChange={(e) => setAnswer(e.target.value)} required />
            <label className="input-label">{t("New password")}</label>
            <input className="text-input" type="password" placeholder="At least 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            <label className="input-label">{t("Confirm new password")}</label>
            <input className="text-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
            {error && <p className="form-error-text">{error}</p>}
            <button className="primary-btn full-btn" disabled={submitting}>{submitting ? t("Resetting...") : t("Reset password")}<ArrowRight size={17} /></button>
          </form>
        </>}
        {step === "done" && <>
          <h2>{t("Password updated")}</h2>
          <p>{t("Your password has been reset. You can now sign in with your new password.")}</p>
          <button className="primary-btn full-btn" onClick={onSwitchToLogin}>{t("Sign in")}<ArrowRight size={17} /></button>
        </>}
        <div className="modal-security"><LockKeyhole size={14} /> {t("Your account is secured with encrypted credentials")}</div>
      </div>
    </div>
  );
}
