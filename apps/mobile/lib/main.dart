import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:pocketbase/pocketbase.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/join_event_screen.dart';
import 'screens/event_screen.dart';
import 'screens/camera_screen.dart';
import 'providers/auth_provider.dart';

void main() {
  runApp(const ProviderScope(child: MyApp()));
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    final router = GoRouter(
      initialLocation: '/',
      redirect: (context, state) {
        final isLoggedIn = authState.isAuthenticated;
        final isLoginRoute = state.uri.toString() == '/login';

        // If logged in and on login page, go to home
        if (isLoggedIn && isLoginRoute) {
          return '/';
        }

        return null;
      },
      routes: [
        GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginScreen(),
        ),
        GoRoute(
          path: '/auth-callback',
          builder: (context, state) {
            // This route is triggered by deep links like eventpix://auth-callback
            final queryParams = state.uri.queryParameters;

            // We can trigger the completion logic here
            WidgetsBinding.instance.addPostFrameCallback((_) {
              ref.read(authProvider.notifier).completeOAuth2(queryParams);
            });

            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          },
        ),
        GoRoute(
          path: '/join/:id',
          builder: (context, state) {
            final event = state.extra as RecordModel;
            return JoinEventScreen(event: event);
          },
        ),
        GoRoute(
          path: '/event/:id',
          builder: (context, state) =>
              EventScreen(eventId: state.pathParameters['id']!),
          routes: [
            GoRoute(
              path: 'camera',
              builder: (context, state) {
                final approvalRequired =
                    state.uri.queryParameters['approvalRequired'] == 'true';
                return CameraScreen(
                  eventId: state.pathParameters['id']!,
                  approvalRequired: approvalRequired,
                );
              },
            ),
          ],
        ),
      ],
    );

    return MaterialApp.router(
      title: 'EventPix',
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: Colors.black,
        primaryColor: const Color(0xFF9333EA), // purple-600
        cardColor: const Color(0xFF171717),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.black,
          elevation: 0,
        ),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF9333EA), // purple-600
          secondary: Color(0xFFA855F7), // purple-500
          surface: Color(0xFF1F1F1F),
          background: Colors.black,
          onPrimary: Colors.white,
          onSecondary: Colors.white,
          onSurface: Colors.white,
          onBackground: Colors.white,
        ),
        textTheme: GoogleFonts.interTextTheme(
          ThemeData.dark().textTheme,
        ).apply(bodyColor: Colors.white, displayColor: Colors.white),
        useMaterial3: true,
      ),
      routerConfig: router,
    );
  }
}
