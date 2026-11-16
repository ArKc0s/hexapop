import nodemailer from "nodemailer";
import { config } from "./config.ts";

const transport = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })
  : null;

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!transport) {
    console.log(`[mail non configuré] à ${to} : ${subject}\n${text}`);
    return;
  }
  const info = await transport.sendMail({ from: `Hexa <${config.smtp.from}>`, to, subject, text });
  // Journal minimal (sans l'adresse complète) pour suivre la délivrabilité.
  const masked = to.replace(/^(.).*(@.*)$/, "$1***$2");
  console.log(`[mail] « ${subject} » → ${masked} : ${info.messageId} ${info.response}`);
}

export const verifyMail = (pseudo: string, link: string) =>
  `Salut ${pseudo} !\n\nConfirme ton adresse pour sauvegarder ta progression et apparaître dans les classements :\n${link}\n\nCe lien est valable 48 heures.\n\nÀ tout de suite sur la carte,\nHexa`;

export const resetMail = (pseudo: string, link: string) =>
  `Salut ${pseudo},\n\nPour choisir un nouveau mot de passe, ouvre ce lien (valable 1 heure) :\n${link}\n\nSi tu n'as rien demandé, ignore cet email.\n\nHexa`;
