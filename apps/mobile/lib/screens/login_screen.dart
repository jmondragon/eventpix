import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  // AuthProviderInfo is likely not exported or named differently in some versions
  // We can use dynamic or just List<dynamic> for simplicity if type is elusive
  List<dynamic> _authProviders = [];

  @override
  void initState() {
    super.initState();
    _fetchAuthMethods();
  }

  Future<void> _fetchAuthMethods() async {
    final pb = ref.read(pocketBaseProvider);
    try {
      final methods = await pb.collection('users').listAuthMethods();
      if (mounted) {
        setState(() {
          final json = methods.toJson();
          _authProviders = (json['authProviders'] as List?) ?? [];
        });
      }
    } catch (e) {
      // ignore
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (_formKey.currentState!.validate()) {
      await ref
          .read(authProvider.notifier)
          .login(_emailController.text.trim(), _passwordController.text.trim());
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    // Redirect if logged in as a real user (not a guest)
    if (authState.isAuthenticated &&
        !authState.isGuest &&
        !authState.isLoading) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go('/');
      });
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Host Login'),
        backgroundColor: Colors.black,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Welcome Back',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                if (authState.error != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red[900]!.withAlpha(76),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      authState.error!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                const SizedBox(height: 16),

                // Email Field
                TextFormField(
                  controller: _emailController,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    labelText: 'EMAIL',
                    labelStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                    filled: true,
                    fillColor: Colors.grey[900],
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  validator: (val) =>
                      val != null && val.contains('@') ? null : 'Invalid email',
                ),
                const SizedBox(height: 16),

                // Password Field
                TextFormField(
                  controller: _passwordController,
                  obscureText: true,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    labelText: 'PASSWORD',
                    labelStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                    filled: true,
                    fillColor: Colors.grey[900],
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  validator: (val) => val != null && val.length >= 5
                      ? null
                      : 'Min 5 characters',
                ),
                const SizedBox(height: 24),

                // Login Button
                SizedBox(
                  height: 50,
                  child: ElevatedButton(
                    onPressed: authState.isLoading ? null : _handleLogin,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.purple[600],
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: authState.isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text(
                            'Sign In',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),

                // Social Login Section
                if (_authProviders.isNotEmpty) ...[
                  const SizedBox(height: 32),
                  const Row(
                    children: [
                      Expanded(child: Divider(color: Colors.grey)),
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16),
                        child: Text(
                          'OR CONTINUE WITH',
                          style: TextStyle(
                            fontSize: 10,
                            color: Colors.grey,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      Expanded(child: Divider(color: Colors.grey)),
                    ],
                  ),
                  const SizedBox(height: 20),
                  ..._authProviders.map((provider) {
                    final name = (provider['name'] as String?) ?? 'Unknown';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: SizedBox(
                        height: 50,
                        child: OutlinedButton.icon(
                          onPressed: authState.isLoading
                              ? null
                              : () => ref
                                    .read(authProvider.notifier)
                                    .loginWithProvider(name),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: BorderSide(color: Colors.grey[800]!),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            backgroundColor: Colors.grey[900],
                          ),
                          icon: _getProviderIcon(name),
                          label: Text(
                            'Sign in with ${name.isNotEmpty ? name[0].toUpperCase() + name.substring(1) : "Provider"}',
                          ),
                        ),
                      ),
                    );
                  }),
                ],

                const SizedBox(height: 40),
                TextButton(
                  onPressed: () => context.go('/'),
                  child: const Text(
                    'Return to Guest Mode',
                    style: TextStyle(color: Colors.grey),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _getProviderIcon(String? name) {
    if (name == 'google') return const Icon(Icons.g_mobiledata, size: 28);
    if (name == 'apple') return const Icon(Icons.apple, size: 24);
    return const Icon(Icons.login, size: 20);
  }
}
