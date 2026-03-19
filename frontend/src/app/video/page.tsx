import { redirect } from 'next/navigation';

export default function VideoRootPage() {
    redirect('/ideation?mode=video');
}
