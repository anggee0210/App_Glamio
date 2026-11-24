// Prueba rápida del correo REAL: envía UN correo a tu propio Gmail y enseña el error exacto si falla.
// Uso: node test/probar-correo.js
require('dotenv').config();
const nodemailer = require('nodemailer');

async function probar() {
  const usuario = process.env.SMTP_USUARIO;
  const clave = (process.env.SMTP_PASSWORD || '').replace(/\s/g, '');
  console.log(`Servidor: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
  console.log(`Usuario:  ${usuario}`);
  console.log(`Contraseña de aplicación: ${clave.length} caracteres (deben ser 16)\n`);

  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: usuario, pass: clave }
  });

  try {
    await transporte.verify(); // 1) ¿Gmail acepta el usuario y la contraseña?
    console.log('✅ Gmail acepta el usuario y la contraseña de aplicación');
    await transporte.sendMail({    // 2) enviar un correo de verdad
      from: `GLAMIO <${usuario}>`,
      to: usuario,
      subject: 'Prueba de correo de GLAMIO',
      text: 'Si lees esto, GLAMIO ya puede enviar correos de verdad.'
    });
    console.log(`✅ Correo enviado a ${usuario}. Mira tu bandeja (o spam).`);
  } catch (err) {
    console.log('❌ No se pudo enviar.');
    console.log('   Código:', err.code || '-', '| Respuesta de Gmail:', err.response || err.message);
  }
}

probar();
