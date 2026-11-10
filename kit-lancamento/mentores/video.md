# Vídeo de lançamento: mentores

Render final: `videos/realiza-mentores/renders/realiza-mentores-v2.mp4`
(22 MB, out/2026). Alternativas e cortes em `videos/lancamento/renders/`.

Uso no kit:

1. Postar o MP4 direto no grupo (vídeo nativo do WhatsApp toca melhor
   que link)
2. Embutir/referenciar no card gerado no Claude
3. Se passar de 64 MB para o WhatsApp, recomprimir:
   `ffmpeg -i entrada.mp4 -c:v libx264 -crf 26 -preset slow -c:a aac -b:a 96k saida.mp4`
