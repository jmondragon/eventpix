import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pocketbase/pocketbase.dart';
import '../providers/auth_provider.dart';
import '../providers/events_provider.dart';
import '../providers/joined_event_provider.dart';
import '../widgets/create_event_dialog.dart';
import '../widgets/user_menu_button.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  String _mode = 'guest'; // 'guest' | 'host'
  final _codeController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _handleJoin() async {
    final code = _codeController.text.trim().toUpperCase();
    if (code.isEmpty) return;

    setState(() => _isLoading = true);
    try {
      final pb = ref.read(pocketBaseProvider);

      // 1. Ensure authenticated (guest login on demand)
      // We must do this FIRST because getEventByCodeProvider
      // might fail if not authenticated
      var authState = ref.read(authProvider);
      if (!authState.isAuthenticated || !pb.authStore.isValid) {
        await ref.read(authProvider.notifier).loginAnonymously();
        authState = ref.read(authProvider);
      }

      final user = authState.user;
      if (user == null) throw Exception('Failed to establish session');

      // 2. Find Event
      final event = await ref.read(getEventByCodeProvider(code).future);

      if (event == null) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Event not found')));
        }
        return;
      }

      // 3. Check if event is open
      if (!event.getBoolValue('is_open')) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('This event is currently closed.')),
          );
        }
        return;
      }

      // 4. Navigate to Join Page
      if (mounted) {
        context.push('/join/${event.id}', extra: event);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error joining: $e')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showSignInPrompt() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF171717),
        title: const Text('Sign In Required'),
        content: const Text(
          'Please sign in with Google or Apple to create events.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(authProvider.notifier).loginWithProvider('google');
            },
            icon: const Icon(Icons.g_mobiledata),
            label: const Text('Sign in with Google'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF9333EA),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.user;

    // Auto-switch to host dashboard if logged in and default
    // logic similar to web: if (isAuthenticated && !guest_) setMode('host')
    // We'll skip auto-switch for now to keep it manual/predictable in mobile app

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'EventPix',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: const [UserMenuButton(), SizedBox(width: 8)],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  children: [
                    const SizedBox(height: 20),
                    Text(
                      'EventPix',
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                    ),
                    const SizedBox(height: 32),

                    // Toggle
                    Container(
                      height: 50,
                      decoration: BoxDecoration(
                        color: Colors.grey[900],
                        borderRadius: BorderRadius.circular(25),
                        border: Border.all(color: Colors.grey[800]!),
                      ),
                      child: Row(
                        children: [
                          _buildToggleBtn('I\'m a Guest', 'guest'),
                          _buildToggleBtn('I\'m a Host', 'host'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 40),

                    if (_mode == 'guest') _buildGuestView(),
                    if (_mode == 'host') _buildHostView(user, authState),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildToggleBtn(String label, String value) {
    final isSelected = _mode == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _mode = value),
        child: Container(
          decoration: BoxDecoration(
            color: isSelected
                ? (value == 'guest' ? Colors.blue[700] : Colors.purple[700])
                : Colors.transparent,
            borderRadius: BorderRadius.circular(25),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              color: isSelected ? Colors.white : Colors.grey,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildGuestView() {
    final publicEventsAsync = ref.watch(publicEventsProvider);

    return Column(
      children: [
        const Text(
          'Join an event to add photos.',
          style: TextStyle(color: Colors.grey),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _codeController,
          textAlign: TextAlign.center,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          textCapitalization: TextCapitalization.characters,
          inputFormatters: [UpperCaseTextFormatter()],
          decoration: InputDecoration(
            hintText: 'ENTER EVENT CODE',
            filled: true,
            fillColor: Colors.grey[900],
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            contentPadding: const EdgeInsets.symmetric(vertical: 16),
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handleJoin,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.blue[600],
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2,
                    ),
                  )
                : const Text(
                    'Join Event',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
          ),
        ),
        const SizedBox(height: 40),
        const Row(
          children: [
            Expanded(child: Divider(color: Colors.grey)),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'OR BROWSE PUBLIC EVENTS',
                style: TextStyle(fontSize: 10, color: Colors.grey),
              ),
            ),
            Expanded(child: Divider(color: Colors.grey)),
          ],
        ),
        const SizedBox(height: 20),
        publicEventsAsync.when(
          data: (events) =>
              Column(children: events.map((e) => _buildEventCard(e)).toList()),
          loading: () => const CircularProgressIndicator(),
          error: (err, stack) => Text('Error: $err'),
        ),
      ],
    );
  }

  Widget _buildHostView(RecordModel? user, AuthState authState) {
    if (user == null) {
      return Column(
        children: [
          const Text(
            'Create an event and invite guests.',
            style: TextStyle(color: Colors.grey),
          ),
          const SizedBox(height: 32),
          const Text(
            'Host Login',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 24),
          if (authState.error != null)
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 24),
              decoration: BoxDecoration(
                color: Colors.red[900]!.withAlpha(76),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                authState.error!,
                style: const TextStyle(color: Colors.red),
              ),
            ),
          // Google Sign-In Button
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              onPressed: () =>
                  ref.read(authProvider.notifier).loginWithProvider('google'),
              icon: const Icon(Icons.g_mobiledata, size: 28),
              label: const Text(
                'Continue with Google',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: Colors.black87,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: Colors.grey[300]!),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Apple Sign-In Button
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              onPressed: () =>
                  ref.read(authProvider.notifier).loginWithProvider('apple'),
              icon: const Icon(Icons.apple, size: 24),
              label: const Text(
                'Continue with Apple',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.black,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Email Login Button
          SizedBox(
            width: double.infinity,
            height: 50,
            child: OutlinedButton.icon(
              onPressed: () => context.push('/login'),
              icon: const Icon(Icons.email, size: 20),
              label: const Text(
                'Continue with Email',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: BorderSide(color: Colors.grey[800]!),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ],
      );
    }

    // Logged In Dashboard (including guests)
    final myEventsAsync = ref.watch(myEventsProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'My Events',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            ElevatedButton(
              onPressed: () {
                if (authState.isGuest) {
                  _showSignInPrompt();
                } else {
                  showDialog(
                    context: context,
                    builder: (ctx) => const CreateEventDialog(),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.purple[600],
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text('+ New Event'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        myEventsAsync.when(
          data: (events) {
            if (events.isEmpty) {
              return Container(
                padding: const EdgeInsets.all(32),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Colors.grey[900]!.withAlpha(128),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey[800]!),
                ),
                child: const Text(
                  'You haven\'t created any events yet.',
                  style: TextStyle(color: Colors.grey),
                ),
              );
            }
            return Column(
              children: events
                  .map((e) => _buildEventCard(e, isHost: true))
                  .toList(),
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, stack) => Text('Error: $err'),
        ),
        const SizedBox(height: 40),
        SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton(
            onPressed: () => ref.read(authProvider.notifier).logout(),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.grey[900],
              foregroundColor: Colors.red[400],
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.red[800]!),
              ),
            ),
            child: const Text(
              'Sign Out',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildEventCard(RecordModel event, {bool isHost = false}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.grey[900],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[800]!),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        title: Text(
          event.getStringValue('name'),
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 16,
            color: Colors.white,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (isHost)
              Text(
                'CODE: ${event.getStringValue('code')}',
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey,
                ),
              ),
            if (!isHost)
              Text(
                event.getStringValue('date').split(' ')[0],
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ), // Simple date
          ],
        ),
        trailing: Icon(
          Icons.arrow_forward_ios,
          size: 16,
          color: isHost ? Colors.purple : Colors.blue,
        ),
        onTap: () {
          context.push('/event/${event.id}');
        },
      ),
    );
  }
}

/// TextInputFormatter that converts all input to uppercase
class UpperCaseTextFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    return TextEditingValue(
      text: newValue.text.toUpperCase(),
      selection: newValue.selection,
    );
  }
}
