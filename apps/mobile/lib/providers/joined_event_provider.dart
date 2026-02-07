import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pocketbase/pocketbase.dart';
import 'auth_provider.dart';

final joinedEventProvider =
    NotifierProvider<JoinedEventNotifier, List<RecordModel>>(
      JoinedEventNotifier.new,
    );

class JoinedEventNotifier extends Notifier<List<RecordModel>> {
  @override
  List<RecordModel> build() => [];

  void addEvent(RecordModel event) {
    if (!hasJoined(event.id)) {
      state = [...state, event];
    }
  }

  bool hasJoined(String eventId) {
    return state.any((e) => e.id == eventId);
  }
}

final getEventByCodeProvider = FutureProvider.family<RecordModel?, String>((
  ref,
  code,
) async {
  final pb = ref.watch(pocketBaseProvider);
  try {
    final records = await pb
        .collection('events')
        .getList(page: 1, perPage: 1, filter: 'code = "$code"');
    if (records.items.isNotEmpty) {
      return records.items.first;
    }
    return null;
  } catch (e) {
    return null;
  }
});
