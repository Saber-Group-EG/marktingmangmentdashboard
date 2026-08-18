import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ThemeProvider } from "./contexts/themeContext";
import { LangProvider } from "./contexts/langContext";
import Layout from "./routes/Layout";
import LoginPage from "./routes/auth/login/page";
import RegisterPage from "./routes/auth/register/page";
import DashboardPage from "./routes/dashboard/page";
import OnboardingPage from "./routes/onboarding/page";
import ClientsPage from "./routes/clients/page";
import ClientInfo from "./routes/clients/ClientInfo";
import PlanningPage from "./routes/planning/page";
import PreviewCampaigns from "./routes/planning/PreviewStratigy";
import ManageCampaignPage from "./routes/planning/manage";
import ServicesPage from "./routes/services/page";
import ItemsPage from "./routes/items/page";
import TermsPage from "./routes/terms/page";
import QuotationsPage from "./routes/quotations/page";
import PackagesPage from "./routes/packages/page";
import AddPackagePage from "./routes/packages/add";
import ContractPage from "./routes/contracts/page";
import ReportsPage from "./routes/reports/page";
import ProfilePage from "./routes/profile/page.tsx";
import CategoriesPage from "./routes/categories/page";
import CastPage from "./routes/cast/page";
import ProjectCompaniesPage from "./routes/projectCompanies/page";
import ProjectsPage from "./routes/Projects/page";
import AddProjectPage from "./routes/Projects/AddProject.tsx";
import ProjectDetailsPage from "./routes/Projects/PreviewProject.tsx";
import EditProjectPage from "./routes/Projects/EditProject.tsx";
import AccountsPage from "./routes/Accounts/table";

function App() {
    // React Router basename should match the build base. Vite exposes the base via import.meta.env.BASE_URL
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    const router = createBrowserRouter(
        [
            {
                path: "/",
                element: <Layout />,
                children: [
                    { index: true, element: <LoginPage /> },
                    { path: "auth/login", element: <LoginPage /> },
                    { path: "auth/register", element: <RegisterPage /> },
                    { path: "dashboard", element: <DashboardPage /> },
                    { path: "onboarding", element: <OnboardingPage /> },
                    { path: "clients", element: <ClientsPage /> },
                    { path: "clients/:id", element: <ClientInfo fullPage={true} /> },
                    { path: "strategies", element: <PlanningPage /> },
                    { path: "strategies/manage", element: <ManageCampaignPage /> },
                    {
                        path: "strategies/preview",
                        element: <PreviewCampaigns clientName="" />,
                    },
                    { path: "services", element: <ServicesPage /> },
                    { path: "items", element: <ItemsPage /> },
                    { path: "accounts", element: <AccountsPage /> },
                    { path: "terms", element: <TermsPage /> },
                    { path: "quotations", element: <QuotationsPage /> },
                    { path: "packages", element: <PackagesPage /> },
                    { path: "packages/add", element: <AddPackagePage /> },
                    { path: "categories", element: <CategoriesPage /> },
                    { path: "cast", element: <CastPage /> },
                    { path: "project-companies", element: <ProjectCompaniesPage /> },
                    { path: "projects", element: <ProjectsPage /> },
                    { path: "projects/add", element: <AddProjectPage /> },
                    { path: "projects/:id", element: <ProjectDetailsPage /> },
                    { path: "projects/:id/edit", element: <EditProjectPage /> },
                    { path: "contracts", element: <ContractPage /> },
                    { path: "contracts/manage", element: <ContractPage /> },
                    { path: "reports", element: <ReportsPage /> },
                    { path: "profile", element: <ProfilePage /> },
                ],
            },
            {
                path: "analytics",
                element: <h1 className="title">Analytics</h1>,
            },
            {
                path: "users",
                element: <h1 className="title">Users</h1>,
            },
        ],
        {
            basename: base,
        },
    );
    return (
        <LangProvider>
            <ThemeProvider storageKey="theme">
                <RouterProvider router={router}></RouterProvider>
            </ThemeProvider>
        </LangProvider>
    );
}

export default App;
