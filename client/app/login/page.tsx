"use client";
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthUI } from '@/components/ui/auth-ui';

function AuthPage() {
  const { login, register } = useAuth();
  const router = useRouter();

  async function handleSignIn(email: string, password: string) {
    try {
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Login failed');
    }
  }

  async function handleSignUp(name: string, email: string, password: string) {
    const [firstName, ...rest] = name.split(' ');
    const lastName = rest.join(' ') || firstName;
    try {
      await register({ email, password, firstName, lastName });
      router.push('/');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Registration failed');
    }
  }

  return (
    <AuthUI
      onSignIn={handleSignIn}
      onSignUp={handleSignUp}
      signInContent={{
        image: { src: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80", alt: "Digital cosmos" },
        quote: { text: "Welcome Back! The journey continues.", author: "TaskFlow" },
      }}
      signUpContent={{
        image: { src: "https://images.unsplash.com/photo-1534972195531-d756b9bfa9f2?w=1200&q=80", alt: "Code visualization" },
        quote: { text: "Create an account. A new chapter awaits.", author: "TaskFlow" },
      }}
    />
  );
}

export default function LoginPage() {
  return <AuthProvider><AuthPage /></AuthProvider>;
}
