import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

const DEFAULT_INSTITUTION =
  process.env.NEXT_PUBLIC_DEFAULT_INSTITUTION_ID || 'inti';

export default async function DashboardLanding() {
  const cookieStore = await cookies();
  const token = cookieStore.get('dashboard_token')?.value;
  
  let targetInstitution = DEFAULT_INSTITUTION;
  
  if (token) {
    try {
      const payloadBase64 = token.split('.')[1];
      if (payloadBase64) {
        const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf8');
        const payload = JSON.parse(payloadStr);
        if (payload.subdomain) {
          targetInstitution = payload.subdomain;
        } else if (payload.institution_id) {
          targetInstitution = payload.institution_id;
        }
      }
    } catch (e) {
      console.error('Failed to parse dashboard_token payload', e);
    }
  }

  redirect(`/${targetInstitution}/overview`);
}
