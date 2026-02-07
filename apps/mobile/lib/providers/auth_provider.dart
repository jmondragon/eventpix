import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pocketbase/pocketbase.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/constants.dart';

final pocketBaseProvider = Provider<PocketBase>((ref) {
  return PocketBase(AppConstants.pocketBaseUrl);
});

class AuthState {
  final RecordModel? user;
  final bool isLoading;
  final String? error;

  AuthState({this.user, this.isLoading = false, this.error});

  bool get isAuthenticated => user != null;
  bool get isGuest =>
      user != null &&
      (user!.getStringValue('email').contains('@eventpix.local') ||
          user!.getStringValue('email').contains('@eventpix.io'));
}

class AuthNotifier extends Notifier<AuthState> {
  late final PocketBase _pb;
  String? _currentCodeVerifier;

  @override
  AuthState build() {
    _pb = ref.read(pocketBaseProvider);
    // Clear stale auth if invalid
    if (!_pb.authStore.isValid) {
      _pb.authStore.clear();
    }
    return AuthState(user: _pb.authStore.record);
  }

  Future<void> login(String email, String password) async {
    state = AuthState(isLoading: true);
    try {
      final wasGuest =
          _pb.authStore.isValid &&
          (_pb.authStore.record!
                  .getStringValue('email')
                  .contains('@eventpix.local') ||
              _pb.authStore.record!
                  .getStringValue('email')
                  .contains('@eventpix.io'));
      // Note: matches guest account creation logic in loginAnonymously
      final guestUserId = _pb.authStore.record?.id;

      final authData = await _pb
          .collection('users')
          .authWithPassword(email, password);

      final record = authData.record;
      if (wasGuest && guestUserId != null) {
        await _transferGuestData(guestUserId, record.id);
      }

      state = AuthState(user: record);
    } catch (e) {
      state = AuthState(error: e.toString());
    }
  }

  Future<void> loginAnonymously() async {
    if (_pb.authStore.isValid && state.user != null) return;

    state = AuthState(isLoading: true);
    try {
      // Fallback: Create a temporary guest account
      // This ensures we have a real user record for RLS policies
      try {
        final guestId = 'guest_${DateTime.now().millisecondsSinceEpoch}';
        final password = 'password123';

        await _pb
            .collection('users')
            .create(
              body: {
                'email': '$guestId@eventpix.local',
                'password': password,
                'passwordConfirm': password,
                'name': 'Guest User',
              },
            );

        final authData = await _pb
            .collection('users')
            .authWithPassword('$guestId@eventpix.local', password);
        state = AuthState(user: authData.record);
      } catch (e2) {
        print('Guest creation failed: $e2');
        // If creation fails (e.g. rate limit), maybe just try to generate a new ID?
        // For now, set error.
        state = AuthState(error: 'Guest login failed');
      }
    } catch (e) {
      state = AuthState(error: e.toString());
    }
  }

  Future<void> completeOAuth2(Map<String, String> queryParams) async {
    // If we don't have a code verifier (app killed?), we can't complete the flow secureley
    // without persistence. For now, we'll assume the app stays alive.
    if (_currentCodeVerifier == null) {
      state = AuthState(error: 'Login session expired. Please try again.');
      return;
    }

    final code = queryParams['code'];
    // final stateParam = queryParams['state']; // optional verification

    if (code == null) {
      state = AuthState(error: 'No auth code returned.');
      return;
    }

    state = AuthState(isLoading: true);

    try {
      final wasGuest = state.isGuest;
      final guestUserId = state.user?.id;
      final redirectUrl = 'eventpix://auth-callback';

      final authData = await _pb
          .collection('users')
          .authWithOAuth2Code(
            'google', // We assume google for now, or we need to store the provider name too
            code,
            _currentCodeVerifier!,
            redirectUrl,
          );

      // If was guest, transfer data to new account
      final record = authData.record;
      if (wasGuest && guestUserId != null) {
        await _transferGuestData(guestUserId, record.id);
      }

      state = AuthState(user: record);
      // Clear used verifier
      _currentCodeVerifier = null;
    } catch (e) {
      state = AuthState(error: e.toString());
    }
  }

  Future<void> loginWithProvider(String providerName) async {
    state = AuthState(isLoading: true);
    try {
      final methods = await _pb.collection('users').listAuthMethods();
      final methodsJson = methods.toJson();
      final providers = (methodsJson['authProviders'] as List?) ?? [];

      final providerMap = providers.firstWhere(
        (p) => (p is Map && p['name'] == providerName),
        orElse: () => throw Exception('Provider $providerName not found'),
      );

      _currentCodeVerifier = providerMap['codeVerifier'];
      final authUrl = providerMap['authUrl'];

      // Construct the URL manually to ensure redirect_uri is correct
      // provider.authUrl already contains state, code_challenge, etc.
      final redirectUrl = 'eventpix://auth-callback';
      final url = Uri.parse(
        authUrl + '&redirect_uri=${Uri.encodeComponent(redirectUrl)}',
      );

      print('Launching auth URL: $url');
      await launchUrl(url, mode: LaunchMode.externalApplication);

      // We don't update state to success here; we wait for the callback.
      // But we keep isLoading = true in the UI?
      // Actually, if the user navigates away, the UI might reset.
      // For now, let's keep it loading.
    } catch (e) {
      state = AuthState(error: e.toString());
    }
  }

  Future<void> _transferGuestData(String guestId, String newUserId) async {
    try {
      // Transfer joined events
      final joinedEvents = await _pb
          .collection('event_participants')
          .getFullList(filter: 'user = "$guestId"');

      for (final participation in joinedEvents) {
        try {
          await _pb
              .collection('event_participants')
              .update(participation.id, body: {'user': newUserId});
        } catch (e) {
          // Continue on error
        }
      }

      // Transfer photos taken by guest
      final photos = await _pb
          .collection('photos')
          .getFullList(filter: 'owner = "$guestId"');

      for (final photo in photos) {
        try {
          await _pb
              .collection('photos')
              .update(photo.id, body: {'owner': newUserId});
        } catch (e) {
          // Continue on error
        }
      }

      // Delete guest user account
      try {
        await _pb.collection('users').delete(guestId);
      } catch (e) {
        // Ignore deletion errors
      }
    } catch (e) {
      // Ignore transfer errors - user is still signed in
    }
  }

  void logout() {
    _pb.authStore.clear();
    state = AuthState();
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(
  AuthNotifier.new,
);
