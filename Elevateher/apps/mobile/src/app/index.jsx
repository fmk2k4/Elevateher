import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { useAuth } from '@/utils/auth';
import { useAuthStore } from '@/utils/auth/store';

export default function Index() {
  const { isReady, isAuthenticated, signIn, signUp, auth } = useAuth();
  const { setAuth } = useAuthStore();

  if (!isReady) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0A1E' }}>
        <ActivityIndicator size="large" color="#EC4899" />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0A1E', padding: 24 }}>
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 16 }}>ElevateHer</Text>
        <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 32 }}>
          Safe AI career mentorship for girls across Southeast Asia
        </Text>
        <TouchableOpacity
          onPress={() => signUp()}
          style={{
            backgroundColor: '#7C3AED',
            paddingVertical: 14,
            paddingHorizontal: 32,
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Sign Up</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => signIn()}
          style={{
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.3)',
            paddingVertical: 14,
            paddingHorizontal: 32,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 16 }}>Sign In</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0A1E', padding: 24 }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 16 }}>
        Welcome back, {auth?.user?.name || 'Mentee'}!
      </Text>
      <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>
        Your safe mentorship journey continues here.
      </Text>
      <TouchableOpacity
        onPress={() => setAuth(null)}
        style={{
          backgroundColor: 'rgba(239,68,68,0.15)',
          paddingVertical: 14,
          paddingHorizontal: 32,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(239,68,68,0.3)',
        }}
      >
        <Text style={{ color: '#FCA5A5', fontWeight: '600', fontSize: 16 }}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
