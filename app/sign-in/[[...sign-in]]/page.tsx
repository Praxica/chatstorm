import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <style>{`
        .cl-footer > *:nth-child(2) {
          display: none !important;
        }
      `}</style>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        appearance={{
          elements: {
            card: "bg-white shadow-sm border border-gray-200",
            headerTitle: "text-gray-900",
            headerSubtitle: "text-gray-600",
            socialButtonsBlockButton: "bg-white border border-gray-300 text-black hover:bg-gray-50",
            socialButtonsBlockButtonText: "text-gray-600",
            dividerLine: "bg-gray-200",
            dividerText: "text-gray-500",
            formFieldLabel: "text-gray-700",
            formFieldInput: "bg-white border border-gray-300 text-gray-900 focus:ring-black focus:border-black",
            formButtonPrimary: "bg-black hover:bg-gray-900 text-white border-black px-4 py-2 rounded",
            footerActionLink: "bg-black hover:bg-gray-900 text-white hover:text-white px-4 py-1 rounded",
            footerAction: "items-center"
          }
        }}
      />
    </div>
  );
} 