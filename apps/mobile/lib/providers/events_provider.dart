import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:async';
import 'package:pocketbase/pocketbase.dart';
import 'auth_provider.dart';

final publicEventsProvider = FutureProvider<List<RecordModel>>((ref) async {
  final pb = ref.watch(pocketBaseProvider);
  final records = await pb
      .collection('events')
      .getList(
        page: 1,
        perPage: 10,
        filter: 'visibility = "public"',
        sort: '-created',
      );
  return records.items;
});

final myEventsProvider = FutureProvider<List<RecordModel>>((ref) async {
  final pb = ref.watch(pocketBaseProvider);
  final authState = ref.watch(authProvider);

  if (!authState.isAuthenticated) return [];

  final user = authState.user!;
  final records = await pb
      .collection('events')
      .getList(
        page: 1,
        perPage: 50,
        filter: 'owner = "${user.id}"',
        sort: '-created',
      );
  return records.items;
});

// Provider to fetch single event details
final eventDetailsProvider = FutureProvider.autoDispose
    .family<RecordModel, String>((ref, eventId) async {
      final pb = ref.watch(pocketBaseProvider);
      return await pb.collection('events').getOne(eventId);
    });

final eventPhotosProvider = StreamProvider.autoDispose
    .family<List<RecordModel>, String>((ref, eventId) {
      final pb = ref.watch(pocketBaseProvider);
      final streamController = StreamController<List<RecordModel>>();

      // 1. Fetch initial data - only approved photos
      pb
          .collection('photos')
          .getList(
            page: 1,
            perPage: 100,
            filter: 'event = "$eventId" && status = "approved"',
            sort: '-created',
            expand: 'owner',
          )
          .then((records) {
            if (!streamController.isClosed) {
              streamController.add(records.items);
            }
          });

      // 2. Subscribe to realtime updates - only approved photos
      Future<void> Function()? unsubscribeFunc;

      pb
          .collection('photos')
          .subscribe('*', (e) async {
            // On any change (create/update/delete), refetch approved photos
            try {
              final records = await pb
                  .collection('photos')
                  .getList(
                    page: 1,
                    perPage: 100,
                    filter: 'event = "$eventId" && status = "approved"',
                    sort: '-created',
                    expand: 'owner',
                  );
              if (!streamController.isClosed) {
                streamController.add(records.items);
              }
            } catch (_) {
              // ignore errors during refresh
            }
          }, filter: 'event = "$eventId"')
          .then((unsubscribe) {
            unsubscribeFunc = unsubscribe;
          });

      // 3. Cleanup
      ref.onDispose(() {
        unsubscribeFunc?.call();
        streamController.close();
      });

      return streamController.stream;
    });
