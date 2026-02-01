import JoinPageClient from "./JoinPageClient";

export function generateStaticParams() {
    return [{ code: '1' }];
}

export const dynamic = 'force-static';

export default function Page() {
    return <JoinPageClient />;
}
