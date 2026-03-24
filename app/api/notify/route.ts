import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, phone } = await request.json();
    
    // Telegram ayarları .env dosyasından alınır
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      // Telegram ayarlanmamışsa hata verme, sadece işlemi geç
      return NextResponse.json({ success: true, message: "Telegram ayarları eksik." });
    }

    // Telegram'a gönderilecek mesajın formatı
    // Markdown yerine HTML kullanıyoruz çünkü e-posta adreslerindeki _, . gibi karakterler Markdown'da hata (400) verebiliyor.
    const text = `🎉 <b>Yeni Ön Kayıt Geldi!</b>\n\n📧 <b>E-posta:</b> ${email}\n📱 <b>Telefon:</b> ${phone}`;

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    // Telegram'a isteği gönder
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Telegram API hatası: ${response.status} - ${errorData}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Bildirim gönderme hatası:", error);
    return NextResponse.json({ success: false, error: "Bildirim gönderilemedi" }, { status: 500 });
  }
}
