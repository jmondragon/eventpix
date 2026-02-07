import EventPageClient from "./EventPageClient";

export function generateStaticParams() {
    return [{ id: '1' }];
}

export const dynamic = 'force-static';
export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <EventPageClient id={id} />;
}
