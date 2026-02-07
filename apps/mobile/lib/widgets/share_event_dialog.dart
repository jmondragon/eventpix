import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

class ShareEventDialog extends StatelessWidget {
  final String eventId;
  final String eventCode;
  final String eventName;

  const ShareEventDialog({
    super.key,
    required this.eventId,
    required this.eventCode,
    required this.eventName,
  });

  String get _webLink => 'https://app.eventpix.io/event/$eventId';

  Future<void> _copyCode(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: eventCode));
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Event code copied!'),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _copyLink(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: _webLink));
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Link copied!'),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _share() async {
    await Share.share(
      'Join my event "$eventName"!\n\nEvent Code: $eventCode\nLink: $_webLink',
      subject: 'Join $eventName on EventPix',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.grey[900],
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header
              Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close, color: Colors.white),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    'SHARE EVENT',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // QR Code
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: QrImageView(
                  data: _webLink,
                  version: QrVersions.auto,
                  size: 200,
                  backgroundColor: Colors.white,
                ),
              ),
              const SizedBox(height: 24),

              // Event Code Section
              _buildLabel('Event Code'),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey[800]!),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      eventCode,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 3,
                        color: Colors.white,
                      ),
                    ),
                    IconButton(
                      onPressed: () => _copyCode(context),
                      icon: const Icon(Icons.copy, color: Colors.blue),
                      tooltip: 'Copy code',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Share Link Section
              _buildLabel('Share Link'),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey[800]!),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _webLink,
                        style: TextStyle(fontSize: 12, color: Colors.grey[400]),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      onPressed: () => _copyLink(context),
                      icon: const Icon(
                        Icons.copy,
                        color: Colors.blue,
                        size: 20,
                      ),
                      tooltip: 'Copy link',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Share Button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: _share,
                  icon: const Icon(Icons.share),
                  label: const Text(
                    'Share Event',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue[600],
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
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

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, left: 4),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Text(
          text.toUpperCase(),
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w900,
            color: Colors.grey[500],
            letterSpacing: 1.5,
          ),
        ),
      ),
    );
  }
}
