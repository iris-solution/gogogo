// Hiển thị media của câu hỏi: hỗ trợ 2 dạng ẢNH và VIDEO.
// - YouTube  -> nhúng trình phát
// - File video (mp4/webm/ogg/mov) -> thẻ <video>
// - Ảnh (png/jpg/jpeg/gif/webp/svg/avif/bmp) -> thẻ <img>
// - Còn lại -> link mở ngoài

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return match ? match[1] : null;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/;
const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)$/;

export default function Media({ url }: { url: string }) {
  const youtubeId = getYouTubeId(url);
  if (youtubeId) {
    return (
      <div className="relative my-3 aspect-video w-full overflow-hidden rounded-lg bg-black">
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube.com/embed/${youtubeId}`}
          title="Media"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  const path = pathOf(url);

  if (VIDEO_EXT.test(path)) {
    return (
      <video
        controls
        src={url}
        className="my-3 w-full overflow-hidden rounded-lg bg-black"
      />
    );
  }

  if (IMAGE_EXT.test(path)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="Media"
        className="mx-auto my-3 block max-h-96 w-auto max-w-full rounded-lg border border-zinc-200 object-contain"
      />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-red-600 underline"
    >
      Mở media
    </a>
  );
}
