import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pocketbase/pocketbase.dart';
import '../providers/auth_provider.dart';

class JoinEventScreen extends ConsumerStatefulWidget {
  final RecordModel event;

  const JoinEventScreen({super.key, required this.event});

  @override
  ConsumerState<JoinEventScreen> createState() => _JoinEventScreenState();
}

class _JoinEventScreenState extends ConsumerState<JoinEventScreen> {
  final List<TextEditingController> _pinControllers = List.generate(
    4,
    (_) => TextEditingController(),
  );
  final List<FocusNode> _focusNodes = List.generate(4, (_) => FocusNode());

  bool _isLoading = false;
  String _error = '';

  @override
  void dispose() {
    for (var c in _pinControllers) {
      c.dispose();
    }
    for (var f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  Future<void> _handleJoin() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      final pb = ref.read(pocketBaseProvider);

      // 1. Ensure authenticated
      var authState = ref.read(authProvider);
      if (!authState.isAuthenticated || !pb.authStore.isValid) {
        await ref.read(authProvider.notifier).loginAnonymously();
        authState = ref.read(authProvider);
      }

      final user = authState.user;
      if (user == null) throw Exception('Authentication failed');

      // 2. Validate PIN if required
      if (widget.event.getStringValue('join_mode') == 'pin') {
        final enteredPin = _pinControllers.map((c) => c.text).join();
        if (enteredPin.length < 4) {
          throw Exception('Please enter the full PIN');
        }

        // Verify PIN by checking if event matches code AND pin
        // This avoids exposing the correct PIN to the client
        final result = await pb
            .collection('events')
            .getList(
              page: 1,
              perPage: 1,
              filter: 'id = "${widget.event.id}" && pin = "$enteredPin"',
            );

        if (result.items.isEmpty) {
          throw Exception('Incorrect PIN');
        }
      }

      // 3. Create participant record if needed
      final existingParticipants = await pb
          .collection('event_participants')
          .getList(
            page: 1,
            perPage: 1,
            filter: 'event = "${widget.event.id}" && user = "${user.id}"',
          );

      if (existingParticipants.items.isEmpty) {
        final approvalRequired = widget.event.getBoolValue('approval_required');
        await pb
            .collection('event_participants')
            .create(
              body: {
                'event': widget.event.id,
                'user': user.id,
                'status': approvalRequired ? 'pending' : 'approved',
              },
            );
      }

      // 4. Navigate
      if (mounted) {
        context.go('/event/${widget.event.id}');
      }
    } catch (e) {
      setState(() => _error = e.toString().replaceAll('Exception: ', ''));
      // If PIN error, clear fields
      if (e.toString().contains('PIN')) {
        for (var c in _pinControllers) {
          c.clear();
        }
        _focusNodes[0].requestFocus();
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPinRequired = widget.event.getStringValue('join_mode') == 'pin';

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Join Event'),
        backgroundColor: Colors.transparent,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                widget.event.getStringValue('name'),
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'Event Code: ',
                    style: TextStyle(color: Colors.grey, fontSize: 16),
                  ),
                  Text(
                    widget.event.getStringValue('code'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 48),

              if (isPinRequired) ...[
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.grey[900],
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey[800]!),
                  ),
                  child: Column(
                    children: [
                      const Text(
                        'EVENT PIN REQUIRED',
                        style: TextStyle(
                          color: Colors.grey,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: List.generate(4, (index) {
                          return SizedBox(
                            width: 50,
                            height: 60,
                            child: TextField(
                              controller: _pinControllers[index],
                              focusNode: _focusNodes[index],
                              autofocus: index == 0,
                              obscureText: true,
                              textAlign: TextAlign.center,
                              keyboardType: TextInputType.number,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(1),
                              ],
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                              decoration: InputDecoration(
                                filled: true,
                                fillColor: Colors.black,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide(
                                    color: Colors.grey[800]!,
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(
                                    color: Color(0xFF9333EA),
                                  ),
                                ),
                              ),
                              onChanged: (value) {
                                if (value.isNotEmpty && index < 3) {
                                  _focusNodes[index + 1].requestFocus();
                                }
                                if (value.isEmpty && index > 0) {
                                  _focusNodes[index - 1].requestFocus();
                                }
                                if (index == 3 && value.isNotEmpty) {
                                  _handleJoin();
                                }
                              },
                            ),
                          );
                        }),
                      ),
                      if (_error.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 16),
                          child: Text(
                            _error,
                            style: const TextStyle(color: Colors.red),
                            textAlign: TextAlign.center,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
              ],

              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleJoin,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue[600],
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 4,
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          isPinRequired ? 'Join Event' : 'Continue as Guest',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
