import { createContext, useContext, useEffect, useState } from 'react';
import { useData } from './DataProvider';
import type { User } from './types';

interface AuthContextType {
    isAuth: boolean;
    user: User | null;
    login: (email: string, pass: string) => Promise<void>;
    logout: () => void;
    listAuthMethods: () => Promise<any>;
    authWithOAuth2: (provider: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const data = useData();
    const [user, setUser] = useState<User | null>(data.getUser());

    useEffect(() => {
        return data.onAuthChange((u) => {
            setUser(u);
        });
    }, [data]);

    const login = (email: string, pass: string) => data.login(email, pass);
    const logout = () => {
        data.logout();
        setUser(null);
    };
    const listAuthMethods = () => data.listAuthMethods();
    const authWithOAuth2 = (provider: string) => data.authWithOAuth2(provider);

    return (
        <AuthContext.Provider value={{ user, isAuth: !!user, login, logout, listAuthMethods, authWithOAuth2 }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
