import AppSidebar from './AppSidebar'

export default function AppShell({ children }) {
    return (
        <div className="flex-1 min-h-0 w-full min-w-0 og-page og-ambient flex flex-col overflow-hidden">
            <div className="og-content flex-1 min-h-0 min-w-0 w-full flex overflow-hidden">
                <AppSidebar />
                <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden py-4 pl-4 pr-0">
                    {children}
                </div>
            </div>
        </div>
    )
}
