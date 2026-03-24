import { NextResponse } from 'next/server';

// Basit bir in-memory (bellek içi) hız sınırlayıcı (Rate Limiter)
// Not: Vercel gibi serverless ortamlarda her instance için ayrı çalışır ama spam'i büyük ölçüde keser.
const rateLimit = new Map<string, { count: number, lastReset: number }>();
const RATE_LIMIT_MAX_REQUESTS = 5; // Dakikada maksimum 5 istek
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 dakika

export async function POST(request: Request) {
  try {
    // 1. GÜVENLİK: IP Tabanlı Hız Sınırı (Rate Limiting)
    const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
    const now = Date.now();
    const userRate = rateLimit.get(ip) || { count: 0, lastReset: now };

    if (now - userRate.lastReset > RATE_LIMIT_WINDOW_MS) {
      userRate.count = 0;
      userRate.lastReset = now;
    }

    if (userRate.count >= RATE_LIMIT_MAX_REQUESTS) {
      console.warn(`Spam engellendi: ${ip}`);
      return NextResponse.json({ success: false, error: "Çok fazla istek gönderdiniz. Lütfen bekleyin." }, { status: 429 });
    }

    userRate.count++;
    rateLimit.set(ip, userRate);

    // 2. GÜVENLİK: Origin (Kaynak) Kontrolü
    // Sadece kendi sitenizden gelen isteklere izin verin (Postman vb. engeller)
    const origin = request.headers.get('origin') || request.headers.get('referer') || '';
    // Geliştirme ortamı (localhost) veya Vercel domainlerine izin ver
    if (origin && !origin.includes('localhost') && !origin.includes('.run.app') && !origin.includes('vercel.app')) {
      console.warn(`Geçersiz kaynaktan istek: ${origin}`);
      return NextResponse.json({ success: false, error: "Yetkisiz erişim." }, { status: 403 });
    }

    const body = await request.json();
    const { email, phone } = body;

    // 3. GÜVENLİK: Veri Doğrulama (Payload Validation)
    if (!email || !phone || typeof email !== 'string' || typeof phone !== 'string') {
      return NextResponse.json({ success: false, error: "Eksik veya geçersiz veri." }, { status: 400 });
    }

    // Çok uzun metinler göndererek botların sistemi yormasını engelle
    if (email.length > 100 || phone.length > 20) {
      return NextResponse.json({ success: false, error: "Veri çok uzun." }, { status: 400 });
    }

    // Telegram ayarları .env dosyasından alınır
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      // Telegram ayarlanmamışsa hata verme, sadece işlemi geç
      return NextResponse.json({ success: true, message: "Telegram ayarları eksik." });
    }

    // Telegram'a gönderilecek mesajın formatı
    // Markdown yerine HTML kullanıyoruz çünkü e-posta adreslerindeki _, . gibi karakterler Markdown'da hata (400) verebiliyor.
    const text = `🎉 <b>Yeni Ön Kayıt Geldi!</b>\n\n📧 <b>E-posta:</b> ${email}\n📱 <b>Telefon:</b> ${phone}\n🌐 <b>IP:</b> ${ip}`;

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
