/**
 * Email notify for contact / support tickets.
 * Primary: Resend (RESEND_API_KEY). Optional fallback: Cloudflare Email binding (EMAIL).
 * Inbox address lives in secret SUPPORT_INBOX_EMAIL (never shown in public UI / API).
 */

/** Resend free sandbox from-address; works to verified owner inbox. */
const DEFAULT_FROM = 'Houdini Analytics <onboarding@resend.dev>';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Private inbox from env/secret only — never hardcode a personal address in source.
 * @returns {string|null}
 */
export function supportInbox(env) {
  const v = String(env?.SUPPORT_INBOX_EMAIL || '')
    .trim()
    .toLowerCase();
  return v || null;
}

function buildBodies(ticket) {
  const subject = `[Houdini] ${ticket.ticketType || 'soporte'}: ${ticket.subject}`;
  const text = [
    'Nuevo ticket de contacto (Houdini Analytics)',
    `ID: ${ticket.id}`,
    `Tipo: ${ticket.ticketType || 'soporte'}`,
    `Nombre: ${ticket.name}`,
    `Email: ${ticket.email}`,
    `Asunto: ${ticket.subject}`,
    '',
    ticket.message,
    '',
    `Creado: ${ticket.createdAt || ''}`,
    ticket.userId ? `User ID: ${ticket.userId}` : null,
    ticket.ip ? `IP: ${ticket.ip}` : null,
  ]
    .filter((line) => line != null)
    .join('\n');

  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.45">
  <p><strong>Nuevo ticket de contacto</strong> — Houdini Analytics</p>
  <ul>
    <li><strong>ID:</strong> ${escapeHtml(ticket.id)}</li>
    <li><strong>Tipo:</strong> ${escapeHtml(ticket.ticketType || 'soporte')}</li>
    <li><strong>Nombre:</strong> ${escapeHtml(ticket.name)}</li>
    <li><strong>Email:</strong> ${escapeHtml(ticket.email)}</li>
    <li><strong>Asunto:</strong> ${escapeHtml(ticket.subject)}</li>
    <li><strong>Creado:</strong> ${escapeHtml(ticket.createdAt || '')}</li>
  </ul>
  <p><strong>Mensaje</strong></p>
  <pre style="white-space:pre-wrap;background:#111;color:#eee;padding:12px;border-radius:8px">${escapeHtml(
    ticket.message
  )}</pre>
</div>`;

  return { subject, text, html };
}

async function sendViaResend(env, ticket, to, subject, text, html) {
  const key = String(env.RESEND_API_KEY || '').trim();
  if (!key) return null;

  const from = String(env.SUPPORT_FROM_EMAIL || DEFAULT_FROM).trim() || DEFAULT_FROM;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: ticket.email,
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error('supportNotify Resend failed', res.status, errBody.slice(0, 400));
    return { emailed: false, provider: 'resend', error: `resend_${res.status}` };
  }

  const data = await res.json().catch(() => ({}));
  return { emailed: true, provider: 'resend', id: data?.id || null };
}

async function sendViaCloudflareEmail(env, ticket, to, subject, text, html) {
  if (!env?.EMAIL || typeof env.EMAIL.send !== 'function') return null;

  const from = String(env.SUPPORT_FROM_EMAIL || '').trim();
  if (!from) {
    return {
      emailed: false,
      provider: 'cloudflare_email',
      error: 'SUPPORT_FROM_EMAIL_required_for_cf_email',
    };
  }

  try {
    await env.EMAIL.send({
      to,
      from,
      replyTo: ticket.email,
      subject,
      text,
      html,
    });
    return { emailed: true, provider: 'cloudflare_email' };
  } catch (err) {
    console.error('supportNotify CF Email failed', err?.code || '', err?.message || err);
    return {
      emailed: false,
      provider: 'cloudflare_email',
      error: err?.message || String(err),
    };
  }
}

/**
 * Best-effort inbox notify after D1 insert.
 * Destination address is never returned to callers / clients.
 * @returns {{ emailed: boolean, provider: string|null, error?: string, id?: string|null }}
 */
export async function notifySupportTicket(env, ticket) {
  const to = supportInbox(env);
  if (!to) {
    console.error('supportNotify missing SUPPORT_INBOX_EMAIL');
    return { emailed: false, provider: null, error: 'SUPPORT_INBOX_EMAIL_missing' };
  }
  const { subject, text, html } = buildBodies(ticket);

  try {
    const resend = await sendViaResend(env, ticket, to, subject, text, html);
    if (resend) return resend;
  } catch (err) {
    console.error('supportNotify Resend error', err?.message || err);
  }

  try {
    const cf = await sendViaCloudflareEmail(env, ticket, to, subject, text, html);
    if (cf) return cf;
  } catch (err) {
    console.error('supportNotify CF Email error', err?.message || err);
  }

  return { emailed: false, provider: null, error: 'no_email_provider' };
}
