import EventPageClient from "./EventPageClient";

export function generateStaticParams() {
    return [{ id: '1' }];
}

export const dynamic = 'force-static';

export default function Page() {
    return <EventPageClient />;
}
