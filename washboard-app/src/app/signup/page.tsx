import SignupForm from '@/components/SignupForm';

// Server component so the form knows whether owner setup is open without
// exposing the code itself.
export const dynamic = 'force-dynamic';

export default function SignupPage() {
  return <SignupForm setupOpen={Boolean(process.env.OWNER_SETUP_CODE)} />;
}
