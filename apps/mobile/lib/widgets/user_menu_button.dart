import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../core/constants.dart';

class UserMenuButton extends ConsumerWidget {
  const UserMenuButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user;

    if (user == null) {
      return const SizedBox.shrink();
    }

    final isGuest = authState.isGuest;
    final displayName = isGuest
        ? 'Guest'
        : (user.getStringValue('name').isEmpty
              ? user.getStringValue('email')
              : user.getStringValue('name'));

    final avatarUrl = user.getStringValue('avatar');
    final hasAvatar = avatarUrl.isNotEmpty;

    return PopupMenuButton<String>(
      icon: CircleAvatar(
        backgroundColor: isGuest ? Colors.grey[700] : const Color(0xFF9333EA),
        radius: 16,
        backgroundImage: hasAvatar
            ? NetworkImage(
                '${AppConstants.pocketBaseUrl}/api/files/${user.collectionName}/${user.id}/$avatarUrl',
              )
            : null,
        child: hasAvatar
            ? null
            : Text(
                displayName[0].toUpperCase(),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
      ),
      color: const Color(0xFF171717),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      offset: const Offset(0, 50),
      itemBuilder: (context) => [
        // User info header
        PopupMenuItem<String>(
          enabled: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                displayName,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: Colors.white,
                ),
              ),
              if (!isGuest && user.getStringValue('email').isNotEmpty)
                Text(
                  user.getStringValue('email'),
                  style: TextStyle(fontSize: 12, color: Colors.grey[400]),
                ),
              if (isGuest)
                Container(
                  margin: const EdgeInsets.only(top: 4),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.grey[800],
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    'Guest Account',
                    style: TextStyle(fontSize: 10, color: Colors.grey[400]),
                  ),
                ),
              const Divider(height: 16),
            ],
          ),
        ),

        // Sign in option for guests
        if (isGuest) ...[
          PopupMenuItem<String>(
            value: 'signin_google',
            child: Row(
              children: [
                Icon(Icons.g_mobiledata, color: Colors.grey[300]),
                const SizedBox(width: 12),
                const Text('Sign in with Google'),
              ],
            ),
          ),
          PopupMenuItem<String>(
            value: 'signin_apple',
            child: Row(
              children: [
                Icon(Icons.apple, color: Colors.grey[300]),
                const SizedBox(width: 12),
                const Text('Sign in with Apple'),
              ],
            ),
          ),
          PopupMenuItem<String>(
            value: 'signin_email',
            child: Row(
              children: [
                Icon(Icons.email, color: Colors.grey[300]),
                const SizedBox(width: 12),
                const Text('Sign in with Email'),
              ],
            ),
          ),
        ],

        // Sign out option for authenticated users
        if (!isGuest)
          PopupMenuItem<String>(
            value: 'signout',
            child: Row(
              children: [
                Icon(Icons.logout, color: Colors.red[400]),
                const SizedBox(width: 12),
                Text('Sign Out', style: TextStyle(color: Colors.red[400])),
              ],
            ),
          ),
      ],
      onSelected: (value) {
        switch (value) {
          case 'signin_google':
            ref.read(authProvider.notifier).loginWithProvider('google');
            break;
          case 'signin_apple':
            ref.read(authProvider.notifier).loginWithProvider('apple');
            break;
          case 'signin_email':
            context.push('/login');
            break;
          case 'signout':
            ref.read(authProvider.notifier).logout();
            break;
        }
      },
    );
  }
}
