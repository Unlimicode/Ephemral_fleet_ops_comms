// PageWrapper provides consistent horizontal and vertical padding across all pages.
// p-6 on desktop, p-4 on mobile via Tailwind responsive prefix.
export default function PageWrapper({ children }) {
    return (
        <div className="p-4 md:p-6 w-full">
            {children}
        </div>
    );
}
