const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: "tanwaranantsingh10@gmail.com",
    pass: "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",
  },
});

async function test() {
  try {
    const info = await transporter.sendMail({
      from: '"ZenAI" <tanwaranantsingh10@gmail.com>',
      to: "tanwaranantsingh10@gmail.com",
      subject: "Test Email from ZenAI",
      text: "Hello this is a test.",
    });
    console.log("Email sent:", info.messageId);
  } catch (err) {
    console.error("Email error:", err);
  }
}

test();
