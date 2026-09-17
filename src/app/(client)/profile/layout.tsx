import { auth } from "@clerk/nextjs/server";
import ProfileContainer from "@/components/ProfileContainer";
import { ProfileSessionProvider } from "@/components/profile/ProfileSession";

// Stan zalogowania z serwera — profil od pierwszego renderu pokazuje właściwy
// wariant (gość widzi tylko wishlistę, reszta konta jest przydymiona).
export default async function ProfileInsideLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = await auth();

  return (
    <ProfileSessionProvider initialSignedIn={!!userId}>
      <ProfileContainer>
        {children}
      </ProfileContainer>
    </ProfileSessionProvider>
  );
}
