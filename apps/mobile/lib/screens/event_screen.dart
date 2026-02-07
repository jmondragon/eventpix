import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/events_provider.dart';
import '../providers/auth_provider.dart';
import '../providers/joined_event_provider.dart';
import '../widgets/share_event_dialog.dart';
import '../widgets/edit_event_dialog.dart';

import 'package:pocketbase/pocketbase.dart';
import '../widgets/photo_card.dart';
import '../widgets/user_menu_button.dart';

class EventScreen extends ConsumerStatefulWidget {
  final String eventId;

  const EventScreen({super.key, required this.eventId});

  @override
  ConsumerState<EventScreen> createState() => _EventScreenState();
}

class _EventScreenState extends ConsumerState<EventScreen> {
  final GlobalKey<AnimatedListState> _listKey = GlobalKey<AnimatedListState>();
  final List<RecordModel> _photos = [];

  @override
  Widget build(BuildContext context) {
    // Listen to stream for side-effects (animations)
    ref.listen<AsyncValue<List<RecordModel>>>(
      eventPhotosProvider(widget.eventId),
      (previous, next) {
        if (next.hasValue && !next.isLoading && !next.hasError) {
          _updateList(next.value!);
        }
      },
    );

    // Watch for initial load / error state
    final photosAsync = ref.watch(eventPhotosProvider(widget.eventId));
    final eventAsync = ref.watch(eventDetailsProvider(widget.eventId));

    // Redirect to Join Page if not joined
    // We check if the current event ID is in the joined list
    // OR if we are the owner (which we check via eventAsync data)

    // Note: This logic runs on every build.
    // We need to be careful not to redirect while loading.

    if (eventAsync.hasValue) {
      final event = eventAsync.value!;
      final user = ref.watch(authProvider).user;
      final isOwner = user?.id == event.getStringValue('owner');

      final joinedEventNotifier = ref.read(joinedEventProvider.notifier);
      // Default to false if provider state is null/loading
      final isJoined = joinedEventNotifier.hasJoined(widget.eventId);

      if (!isOwner && !isJoined) {
        // Schedule redirect to avoid build-phase navigation error
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            context.go('/join/${widget.eventId}', extra: event);
          }
        });
        // Return loading or empty while redirecting
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: eventAsync.when(
          data: (event) => Text(event.getStringValue('name')),
          loading: () => const Text('Event Gallery'),
          error: (_, __) => const Text('Event Gallery'),
        ),
        backgroundColor: Colors.black,
        actions: [
          eventAsync.when(
            data: (event) {
              final currentUser = ref.watch(authProvider).user;
              final isOwner = currentUser?.id == event.getStringValue('owner');
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isOwner)
                    IconButton(
                      icon: const Icon(Icons.edit),
                      onPressed: () => _showEditDialog(event),
                    ),
                  IconButton(
                    icon: const Icon(Icons.share),
                    onPressed: () => _showShareDialog(event),
                  ),
                  const UserMenuButton(),
                ],
              );
            },
            loading: () => const Row(
              mainAxisSize: MainAxisSize.min,
              children: [UserMenuButton()],
            ),
            error: (_, __) => const Row(
              mainAxisSize: MainAxisSize.min,
              children: [UserMenuButton()],
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          // Invalidate the photos provider to force a refresh
          ref.invalidate(eventPhotosProvider(widget.eventId));
          // Wait a bit for the provider to refresh
          await Future.delayed(const Duration(milliseconds: 500));
        },
        child: photosAsync.when(
          data: (photos) {
            // Initial population check
            if (_photos.isEmpty && photos.isNotEmpty) {
              _photos.addAll(photos);
            }

            if (_photos.isEmpty) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.photo_library_outlined,
                      size: 64,
                      color: Colors.grey,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'No photos yet.',
                      style: TextStyle(color: Colors.grey[400]),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Pull down to refresh',
                      style: TextStyle(color: Colors.grey[600], fontSize: 12),
                    ),
                  ],
                ),
              );
            }

            return AnimatedList(
              key: _listKey,
              initialItemCount: _photos.length,
              padding: const EdgeInsets.all(16),
              itemBuilder: (context, index, animation) {
                if (index >= _photos.length) return const SizedBox.shrink();
                final photo = _photos[index];
                return _buildItem(photo, animation);
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, stack) => Center(child: Text('Error: $err')),
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Upload button
          FloatingActionButton(
            heroTag: 'upload',
            onPressed: _handleUpload,
            backgroundColor: Colors.grey[800],
            child: const Icon(Icons.photo_library, size: 20),
          ),
          const SizedBox(width: 16),
          // Camera button
          FloatingActionButton(
            heroTag: 'camera',
            onPressed: () => _navigateToCamera(ref),
            backgroundColor: Colors.blue[600],
            child: const Icon(Icons.camera_alt, size: 24),
          ),
        ],
      ),
    );
  }

  void _showShareDialog(RecordModel event) {
    showDialog(
      context: context,
      builder: (ctx) => ShareEventDialog(
        eventId: event.id,
        eventCode: event.getStringValue('code'),
        eventName: event.getStringValue('name'),
      ),
    );
  }

  void _showEditDialog(RecordModel event) {
    showDialog(
      context: context,
      builder: (ctx) => EditEventDialog(event: event),
    );
  }

  void _navigateToCamera(WidgetRef ref) {
    final eventAsync = ref.read(eventDetailsProvider(widget.eventId));
    eventAsync.when(
      data: (event) {
        final approvalRequired = event.getBoolValue('approval_required');
        context.push(
          '/event/${widget.eventId}/camera?approvalRequired=$approvalRequired',
        );
      },
      loading: () => context.push(
        '/event/${widget.eventId}/camera?approvalRequired=false',
      ),
      error: (_, __) => context.push(
        '/event/${widget.eventId}/camera?approvalRequired=false',
      ),
    );
  }

  Future<void> _handleUpload() async {
    // TODO: Implement file picker for photo upload
    // For now, just navigate to camera as fallback
    _navigateToCamera(ref);
  }

  Widget _buildItem(RecordModel photo, Animation<double> animation) {
    return FadeTransition(
      opacity: animation,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: PhotoCard(
          key: ValueKey(photo.id),
          photo: photo,
          eventOwnerId: '',
        ),
      ),
    );
  }

  void _updateList(List<RecordModel> newPhotos) {
    // Handle insertions (usually at top because of sort '-created')
    // and deletions (anywhere)

    // 1. Find removed items
    // We iterate backwards to maintain index validity during removal
    for (int i = _photos.length - 1; i >= 0; i--) {
      final oldPhoto = _photos[i];
      // Check if oldPhoto is present in newPhotos
      if (!newPhotos.any((p) => p.id == oldPhoto.id)) {
        // Removed!
        final removedItem = _photos.removeAt(i);
        _listKey.currentState?.removeItem(
          i,
          (context, animation) => _buildItem(removedItem, animation),
          duration: const Duration(milliseconds: 500),
        );
      }
    }

    // 2. Find added items
    for (int i = 0; i < newPhotos.length; i++) {
      final newPhoto = newPhotos[i];
      if (!_photos.any((p) => p.id == newPhoto.id)) {
        // New Item!
        // Since list is sorted by creation time (newest first),
        // new photos *should* be at index 0.
        // BUT if we are refetching the whole list, the index might vary if we insert in loop.
        // Ideally we insert at the same index as in newPhotos.

        // Simplified: Logic for prepending (common for social feeds)
        // If newPhotos[0] is not in _photos, insert at 0.

        _photos.insert(i, newPhoto);
        _listKey.currentState?.insertItem(
          i,
          duration: const Duration(milliseconds: 500),
        );
      } else {
        // Update existing item data (e.g. likes/captions changed)
        // We need to update the model in _photos so the UI reflects changes
        // even if not animating position.
        // AnimatedList doesn't auto-update content of existing items unless setState called.
        // Since we modify _photos[index], the *next* build might show it?
        // Actually, the AnimatedList holds state.
        // We might need to manually trigger update if deep properties changed.
        // But PhotoCard manages its own state for likes!
        // However, for caption changes from OTHER users, we need to update.

        final existingIndex = _photos.indexWhere((p) => p.id == newPhoto.id);
        if (existingIndex != -1) {
          _photos[existingIndex] = newPhoto;
          // Force rebuild of item? setState triggers rebuild of the whole List?
        }
      }
    }
    // After updates, verify order?
    // Usually fetching returns sorted list. Our insertions respect 'i'.
  }
}
