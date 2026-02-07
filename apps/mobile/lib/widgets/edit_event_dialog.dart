import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pocketbase/pocketbase.dart';
import '../providers/auth_provider.dart';
import '../providers/events_provider.dart';

class EditEventDialog extends ConsumerStatefulWidget {
  final RecordModel event;

  const EditEventDialog({super.key, required this.event});

  @override
  ConsumerState<EditEventDialog> createState() => _EditEventDialogState();
}

class _EditEventDialogState extends ConsumerState<EditEventDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _pinController;

  late String _visibility;
  late String _joinMode;
  late bool _approvalRequired;
  bool _isUpdating = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(
      text: widget.event.getStringValue('name'),
    );
    _pinController = TextEditingController(
      text: widget.event.getStringValue('pin'),
    );
    _visibility = widget.event.getStringValue('visibility');
    _joinMode = widget.event.getStringValue('join_mode');
    _approvalRequired = widget.event.getBoolValue('approval_required');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _handleUpdate() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isUpdating = true);

    try {
      final pb = ref.read(pocketBaseProvider);

      await pb
          .collection('events')
          .update(
            widget.event.id,
            body: {
              'name': _nameController.text.trim(),
              'visibility': _visibility,
              'join_mode': _joinMode,
              'pin': _joinMode == 'pin' ? _pinController.text.trim() : '',
              'approval_required': _approvalRequired,
            },
          );

      // Invalidate the events list to refresh
      ref.invalidate(eventDetailsProvider(widget.event.id));
      ref.invalidate(myEventsProvider);

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Event updated successfully!'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isUpdating = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update event: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.grey[900],
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header
                Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.arrow_back, color: Colors.white),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'EDIT EVENT',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Event Name
                _buildLabel('Event Name'),
                TextFormField(
                  controller: _nameController,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                  decoration: _inputDecoration('e.g. Smith Wedding'),
                  validator: (value) =>
                      value?.trim().isEmpty ?? true ? 'Required' : null,
                ),
                const SizedBox(height: 16),

                // Event Code (Read-only)
                _buildLabel('Event Code (Cannot be changed)'),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.grey[850],
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey[800]!),
                  ),
                  child: Text(
                    widget.event.getStringValue('code'),
                    style: const TextStyle(
                      color: Colors.grey,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 2,
                      fontSize: 16,
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Visibility & Join Mode Row
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildLabel('Visibility'),
                          DropdownButtonFormField<String>(
                            value: _visibility,
                            onChanged: (value) {
                              if (value != null) {
                                setState(() => _visibility = value);
                              }
                            },
                            dropdownColor: Colors.black,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                            decoration: _inputDecoration(''),
                            items: const [
                              DropdownMenuItem(
                                value: 'public',
                                child: Text('🌍 Public'),
                              ),
                              DropdownMenuItem(
                                value: 'unlisted',
                                child: Text('🔗 Unlisted'),
                              ),
                              DropdownMenuItem(
                                value: 'private',
                                child: Text('🔒 Private'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildLabel('Join Mode'),
                          DropdownButtonFormField<String>(
                            value: _joinMode,
                            onChanged: (value) {
                              if (value != null) {
                                setState(() => _joinMode = value);
                              }
                            },
                            dropdownColor: Colors.black,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                            decoration: _inputDecoration(''),
                            items: const [
                              DropdownMenuItem(
                                value: 'open',
                                child: Text('✨ Open'),
                              ),
                              DropdownMenuItem(
                                value: 'pin',
                                child: Text('🔢 PIN'),
                              ),
                              DropdownMenuItem(
                                value: 'invite_only',
                                child: Text('📩 Invite'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                // PIN Field (conditional)
                if (_joinMode == 'pin') ...[
                  const SizedBox(height: 16),
                  _buildLabel('Secure PIN'),
                  TextFormField(
                    controller: _pinController,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 8,
                    ),
                    textAlign: TextAlign.center,
                    keyboardType: TextInputType.number,
                    decoration: _inputDecoration('1234'),
                    validator: (value) =>
                        value?.trim().isEmpty ?? true ? 'Required' : null,
                  ),
                ],

                const SizedBox(height: 16),

                // Approval Required Toggle
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
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Require Approval',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          Text(
                            'Photos must be approved before showing',
                            style: TextStyle(
                              color: Colors.grey[500],
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                      Switch(
                        value: _approvalRequired,
                        onChanged: (value) =>
                            setState(() => _approvalRequired = value),
                        activeColor: Colors.purple[600],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // Update Button
                SizedBox(
                  height: 50,
                  child: ElevatedButton(
                    onPressed: _isUpdating ? null : _handleUpdate,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.purple[600],
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: Colors.purple[900],
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _isUpdating
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Update Event',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, left: 4),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w900,
          color: Colors.grey[500],
          letterSpacing: 1.5,
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: Colors.grey[700]),
      filled: true,
      fillColor: Colors.black,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey[800]!),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey[800]!),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.purple[600]!, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Colors.red),
      ),
      contentPadding: const EdgeInsets.all(16),
    );
  }
}
