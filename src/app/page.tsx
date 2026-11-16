import { APP_NAME, APP_TAGLINE } from "@/lib/app-info";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-4xl font-semibold">{APP_NAME}</h1>
      <p className="text-neutral-600 dark:text-neutral-400">{APP_TAGLINE}</p>
    </main>
  );
}
