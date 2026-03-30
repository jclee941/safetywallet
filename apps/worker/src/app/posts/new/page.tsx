import { Header } from "@/components/header";
import { NewPostClient } from "./new-post-client";

export default function NewPostPage() {
  return (
    <div className="min-h-screen bg-muted">
      <Header />
      <NewPostClient />
    </div>
  );
}
