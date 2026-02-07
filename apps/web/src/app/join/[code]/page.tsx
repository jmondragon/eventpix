import JoinPageClient from "./JoinPageClient";

export function generateStaticParams() {
    return [{ code: '1' }];
}

export const dynamic = 'force-static';
export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    return <JoinPageClient code={code} />;
}
