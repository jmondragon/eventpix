import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:pocketbase/pocketbase.dart';
import '../providers/auth_provider.dart';

// We need to initialize cameras in main.dart usually,
// but for simplicity we can check available cameras here.

class CameraScreen extends ConsumerStatefulWidget {
  final String eventId;
  final bool approvalRequired;

  const CameraScreen({
    super.key,
    required this.eventId,
    this.approvalRequired = false,
  });

  @override
  ConsumerState<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends ConsumerState<CameraScreen> {
  CameraController? _controller;
  List<CameraDescription>? _cameras;
  bool _isInitialized = false;
  bool _isUploading = false;
  XFile? _capturedFile;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    _cameras = await availableCameras();
    if (_cameras != null && _cameras!.isNotEmpty) {
      _controller = CameraController(
        _cameras![0],
        ResolutionPreset.high,
        enableAudio: false,
      );
      await _controller!.initialize();
      if (mounted) {
        setState(() => _isInitialized = true);
      }
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _takePicture() async {
    if (!_isInitialized || _controller == null) return;
    try {
      final file = await _controller!.takePicture();
      setState(() => _capturedFile = file);
    } catch (e) {
      // ignore
    }
  }

  Future<void> _uploadPhoto() async {
    if (_capturedFile == null) return;

    setState(() => _isUploading = true);

    final pb = ref.read(pocketBaseProvider);

    try {
      // Upload logic
      List<http.MultipartFile> files = [];
      if (kIsWeb) {
        final bytes = await _capturedFile!.readAsBytes();
        files.add(
          http.MultipartFile.fromBytes('file', bytes, filename: 'capture.jpg'),
        );
      } else {
        files.add(
          await http.MultipartFile.fromPath(
            'file',
            _capturedFile!.path,
            filename: 'capture.jpg', // Explicitly set filename just in case
          ),
        );
      }

      final user = ref.read(authProvider).user;

      // Set status based on approval requirement
      final status = widget.approvalRequired ? 'pending' : 'approved';

      await pb
          .collection('photos')
          .create(
            body: {
              'event': widget.eventId,
              if (user != null) 'owner': user.id,
              'status': status,
            },
            files: files,
          );

      if (mounted) {
        // Show appropriate success message
        if (widget.approvalRequired) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Photo uploaded! Waiting for host approval.'),
              backgroundColor: Colors.blue,
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Photo uploaded successfully!'),
              backgroundColor: Colors.green,
            ),
          );
        }
        context.pop(); // Go back to event screen
      }
    } catch (e) {
      if (mounted) {
        String errorMessage = 'Upload failed: $e';
        if (e is ClientException) {
          errorMessage += '\nResponse: ${e.response['data']}';
        }
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(errorMessage)));
        print(errorMessage); // Log to console for debugging
        setState(() => _isUploading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          children: [
            const Center(child: CircularProgressIndicator()),
            Positioned(
              top: 50,
              left: 20,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white, size: 30),
                onPressed: () => context.pop(),
              ),
            ),
          ],
        ),
      );
    }

    if (_capturedFile != null) {
      // Preview Mode
      return Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          children: [
            Positioned.fill(
              child: ColoredBox(
                color: Colors.black,
                child: kIsWeb
                    ? Image.network(_capturedFile!.path, fit: BoxFit.contain)
                    : Image.file(
                        File(_capturedFile!.path),
                        fit: BoxFit.contain,
                      ),
              ),
            ),
            if (_isUploading)
              Container(
                color: Colors.black54,
                child: const Center(child: CircularProgressIndicator()),
              ),

            Positioned(
              bottom: 30,
              left: 20,
              right: 20,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  TextButton(
                    onPressed: _isUploading
                        ? null
                        : () => setState(() => _capturedFile = null),
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.white,
                      backgroundColor: Colors.black54,
                    ),
                    child: const Text('Retake'),
                  ),
                  ElevatedButton(
                    onPressed: _isUploading ? null : _uploadPhoto,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blue,
                      foregroundColor: Colors.white,
                    ),
                    child: const Text('Use Photo'),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    // Camera Preview Mode
    return Scaffold(
      backgroundColor: Colors.black,
      body: OrientationBuilder(
        builder: (context, orientation) {
          final isPortrait = orientation == Orientation.portrait;

          return Stack(
            children: [
              // 1. Camera Preview (centered and aspect-ratio correct)
              Center(
                child: AspectRatio(
                  aspectRatio: 1 / _controller!.value.aspectRatio,
                  child: CameraPreview(_controller!),
                ),
              ),

              // 2. UI Elements that should rotate
              // Close button
              Positioned(
                top: 50,
                left: 20,
                child: AnimatedRotation(
                  duration: const Duration(milliseconds: 300),
                  turns: isPortrait ? 0 : -0.25, // Rotate 90 deg if landscape
                  child: IconButton(
                    icon: const Icon(
                      Icons.close,
                      color: Colors.white,
                      size: 30,
                    ),
                    onPressed: () => context.pop(),
                  ),
                ),
              ),

              // Shutter button
              Positioned(
                bottom: isPortrait ? 40 : null,
                right: isPortrait ? 0 : 40,
                left: isPortrait ? 0 : null,
                top: isPortrait ? null : 0,
                child: Align(
                  alignment: isPortrait
                      ? Alignment.bottomCenter
                      : Alignment.centerRight,
                  child: Padding(
                    padding: isPortrait
                        ? const EdgeInsets.only(bottom: 20)
                        : const EdgeInsets.only(right: 20),
                    child: GestureDetector(
                      onTap: _takePicture,
                      child: Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 4),
                          color: Colors.white24,
                        ),
                        child: Center(
                          child: Container(
                            width: 66,
                            height: 66,
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
