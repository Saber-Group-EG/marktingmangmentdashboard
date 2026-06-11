import { useState, type ReactNode } from "react";
import { Eye, EyeOff, Lock, ShieldAlert } from "lucide-react";

interface PasswordGateProps {
    children: ReactNode;
}

const PasswordGate = ({ children }: PasswordGateProps) => {
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(false);
    const [unlocked, setUnlocked] = useState(false);

    const correctPassword = import.meta.env.VITE_ACCOUNTS_PAGE_PASSWORD;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === correctPassword) {
            setUnlocked(true);
            setError(false);
        } else {
            setError(true);
        }
    };

    if (unlocked) return <>{children}</>;

    return (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
            <div className="w-full max-w-sm rounded-3xl border border-light-200/70 bg-white/90 p-8 shadow-sm dark:border-dark-700/70 dark:bg-dark-900/65">
                <div className="mb-6 flex flex-col items-center gap-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
                        <Lock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-light-900 dark:text-dark-50">
                        Protected Page
                    </h2>
                    <p className="text-sm text-light-600 dark:text-dark-400">
                        Enter the password to access this page.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError(false);
                            }}
                            placeholder="Password"
                            className="w-full rounded-xl border border-light-200 bg-white px-4 py-2.5 pr-10 text-sm text-light-900 placeholder-light-400 outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 dark:border-dark-600 dark:bg-dark-800 dark:text-dark-100 dark:placeholder-dark-500 dark:focus:border-amber-500"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-light-400 hover:text-light-600 dark:text-dark-400"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                            <ShieldAlert className="h-4 w-4" />
                            <span>Incorrect password</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                    >
                        Unlock
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PasswordGate;
