import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pocketbase/pocketbase.dart';
import '../providers/auth_provider.dart';
import '../core/constants.dart';

class PhotoCard extends ConsumerStatefulWidget {
  final RecordModel photo;
  final String eventOwnerId;

  const PhotoCard({super.key, required this.photo, required this.eventOwnerId});

  @override
  ConsumerState<PhotoCard> createState() => _PhotoCardState();
}

class _PhotoCardState extends ConsumerState<PhotoCard> {
  bool _isLiked = false;
  int _likeCount = 0;
  bool _isDeleting = false;
  bool _isEditing = false;
  late TextEditingController _captionController;

  @override
  void initState() {
    super.initState();
    _captionController = TextEditingController(
      text: widget.photo.getStringValue('caption'),
    );
    _initLikeState();
  }

  void _initLikeState() {
    final userId = ref.read(authProvider).user?.id;
    final likes = widget.photo.getListValue<String>('likes');
    _likeCount = likes.length;
    _isLiked = userId != null && likes.contains(userId);
  }

  @override
  void didUpdateWidget(PhotoCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.photo != widget.photo) {
      _initLikeState();
      if (!_isEditing) {
        _captionController.text = widget.photo.getStringValue('caption');
      }
    }
  }

  @override
  void dispose() {
    _captionController.dispose();
    super.dispose();
  }

  Future<void> _toggleLike() async {
    final user = ref.read(authProvider).user;
    if (user == null) return;

    // Optimistic Update
    setState(() {
      if (_isLiked) {
        _isLiked = false;
        _likeCount--;
      } else {
        _isLiked = true;
        _likeCount++;
      }
    });

    final pb = ref.read(pocketBaseProvider);
    try {
      final likes = widget.photo.getListValue<String>('likes');
      if (_isLiked) {
        if (!likes.contains(user.id)) likes.add(user.id);
      } else {
        likes.remove(user.id);
      }

      await pb
          .collection('photos')
          .update(widget.photo.id, body: {'likes': likes});
    } catch (e) {
      // Revert on error
      setState(() {
        _isLiked = !_isLiked;
        _likeCount += _isLiked ? 1 : -1;
      });
    }
  }

  Future<void> _deletePhoto() async {
    final pb = ref.read(pocketBaseProvider);
    setState(() => _isDeleting = true);
    try {
      await pb.collection('photos').delete(widget.photo.id);
    } catch (e) {
      if (mounted) {
        setState(() => _isDeleting = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
      }
    }
  }

  Future<void> _saveCaption() async {
    final pb = ref.read(pocketBaseProvider);
    try {
      await pb
          .collection('photos')
          .update(widget.photo.id, body: {'caption': _captionController.text});
      setState(() => _isEditing = false);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Update failed: $e')));
    }
  }

  String _formatTimestamp(String created) {
    final date = DateTime.parse(created);
    final diff = DateTime.now().difference(date);
    if (diff.inDays > 0) return '${diff.inDays}d ago';
    if (diff.inHours > 0) return '${diff.inHours}h ago';
    if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
    return 'Just now';
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final isOwner =
        user != null && user.id == widget.photo.getStringValue('owner');

    final fileName = widget.photo.getStringValue('file');
    final url =
        '${AppConstants.pocketBaseUrl}/api/files/${widget.photo.collectionId}/${widget.photo.id}/$fileName';

    final ownerData = widget.photo.getListValue<RecordModel>('expand.owner');
    final ownerName = isOwner
        ? 'You'
        : (ownerData.isNotEmpty
              ? (ownerData.first.getStringValue('name').isNotEmpty
                    ? ownerData.first.getStringValue('name')
                    : ownerData.first.getStringValue('email'))
              : 'Guest');

    final caption = widget.photo.getStringValue('caption');

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: Colors.grey[900],
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(77),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Image with overlaid buttons
          Stack(
            children: [
              SizedBox(
                width: double.infinity,
                child: GestureDetector(
                  onDoubleTap: _toggleLike,
                  child: Image.network(
                    url,
                    fit: BoxFit.cover,
                    alignment: Alignment.center,
                    loadingBuilder: (ctx, child, progress) {
                      if (progress == null) return child;
                      return Container(
                        height: 200,
                        color: Colors.grey[850],
                        child: Center(
                          child: CircularProgressIndicator(
                            value: progress.expectedTotalBytes != null
                                ? progress.cumulativeBytesLoaded /
                                      progress.expectedTotalBytes!
                                : null,
                          ),
                        ),
                      );
                    },
                    errorBuilder: (ctx, error, stackTrace) => Container(
                      height: 200,
                      color: Colors.grey[800],
                      child: const Icon(
                        Icons.broken_image,
                        color: Colors.white54,
                      ),
                    ),
                  ),
                ),
              ),

              // Top-right buttons (Edit & Delete) - only show for owner
              if (isOwner && !_isEditing)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Row(
                    children: [
                      // Edit button
                      _buildOverlayButton(
                        icon: Icons.edit,
                        backgroundColor: Colors.black.withValues(alpha: 0.5),
                        onTap: () => setState(() => _isEditing = true),
                      ),
                      const SizedBox(width: 8),
                      // Delete button
                      _buildOverlayButton(
                        icon: _isDeleting ? null : Icons.delete,
                        backgroundColor: Colors.red.withValues(alpha: 0.8),
                        onTap: _isDeleting ? null : _showDeleteDialog,
                        child: _isDeleting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : null,
                      ),
                    ],
                  ),
                ),

              // Bottom-right like button - always visible
              if (!_isEditing)
                Positioned(bottom: 8, right: 8, child: _buildLikeButton()),
            ],
          ),

          // Footer with caption and metadata
          Container(
            padding: const EdgeInsets.all(12),
            color: Colors.grey[900],
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Caption editing mode
                if (_isEditing)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextField(
                        controller: _captionController,
                        maxLines: 2,
                        style: const TextStyle(color: Colors.white),
                        decoration: InputDecoration(
                          hintText: 'Add a caption...',
                          hintStyle: TextStyle(color: Colors.grey[600]),
                          filled: true,
                          fillColor: Colors.grey[800],
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: const EdgeInsets.all(12),
                        ),
                        autofocus: true,
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton(
                            onPressed: () => setState(() => _isEditing = false),
                            child: Text(
                              'Cancel',
                              style: TextStyle(color: Colors.grey[400]),
                            ),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            onPressed: _saveCaption,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.blue[600],
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 8,
                              ),
                            ),
                            child: const Text('Save'),
                          ),
                        ],
                      ),
                    ],
                  )
                else ...[
                  // Display caption if exists
                  if (caption.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(
                        caption,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  // Owner and timestamp
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'by $ownerName',
                        style: TextStyle(color: Colors.grey[400], fontSize: 12),
                      ),
                      Text(
                        _formatTimestamp(
                          widget.photo.getStringValue('created'),
                        ),
                        style: TextStyle(color: Colors.grey[400], fontSize: 12),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOverlayButton({
    IconData? icon,
    required Color backgroundColor,
    VoidCallback? onTap,
    Widget? child,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: child ?? Icon(icon, color: Colors.white, size: 16),
          ),
        ),
      ),
    );
  }

  Widget _buildLikeButton() {
    return Container(
      decoration: BoxDecoration(
        color: _isLiked
            ? Colors.red.withValues(alpha: 0.9)
            : Colors.black.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _toggleLike,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _isLiked ? Icons.favorite : Icons.favorite_border,
                  color: Colors.white,
                  size: 16,
                ),
                const SizedBox(width: 4),
                Text(
                  '$_likeCount',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showDeleteDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Photo?'),
        content: const Text('This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _deletePhoto();
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}
