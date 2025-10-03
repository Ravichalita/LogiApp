
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse('URL da imagem não fornecida', { status: 400 });
  }

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      return new NextResponse(`Falha ao buscar imagem: ${response.statusText}`, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(Buffer.from(imageBuffer), {
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('Erro no proxy de imagem:', error);
    return new NextResponse('Erro interno do servidor', { status: 500 });
  }
}
