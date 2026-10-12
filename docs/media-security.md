# AR-DINE — Media Storage Security & Consistency Architecture

## 1. Executive Summary

Media security in AR-DINE protects against malicious file uploads, directory traversal, cross-tenant data leaks, and corrupting historical order snapshots.

| Security Control | Implementation | Verification Status |
| :--- | :--- | :--- |
| **Magic Byte Verification** | Inspects binary file header signatures for JPEG, PNG, WebP, and GLB | **`VERIFIED LOCALLY`** (Unit tested) |
| **File Size Constraints** | Enforces 5 MB cap for images; 25 MB cap for 3D GLB assets | **`VERIFIED LOCALLY`** (Unit tested) |
| **Path Traversal Defense** | Rejects `..` sequences and verifies target path stays within base directory using `path.relative` | **`VERIFIED LOCALLY`** (Unit tested) |
| **Tenant Scoped Isolation** | Enforces `restaurants/<restaurantId>/` storage key prefix on all uploads and deletions | **`VERIFIED LOCALLY`** (Unit tested) |
| **Historical Order Integrity** | Preserves `OrderItemSnapshot` independently of subsequent menu edits or dish deletions | **`VERIFIED AGAINST STAGING`** (Atlas live tested) |
| **Secret Sanitization** | Server-side only storage of cloud credentials; error sanitization prevents secret leaks | **`VERIFIED LOCALLY`** (Unit tested) |

---

## 2. Magic Byte Inspection & File Signature Defense

MIME types and file extensions can be spoofed by attackers. AR-DINE strictly inspects the initial binary buffer bytes before any file is saved to disk or transmitted to cloud storage:

1. **JPEG Images:**
   - Signature: `0xFF 0xD8 0xFF`
   - Validates bytes 0–2 of the binary buffer.
2. **PNG Images:**
   - Signature: `0x89 0x50 0x4E 0x47` (ASCII `‰PNG`)
   - Validates bytes 0–3 of the binary buffer.
3. **WebP Images:**
   - Signature: `RIFF` at bytes 0–3, followed by `WEBP` at bytes 8–11.
4. **3D GLB Models:**
   - Signature: ASCII `glTF` (`0x67 0x6C 0x54 0x46`)
   - Validates bytes 0–3 of the binary buffer. Any non-GLB binary or HTML exploit disguised as `.glb` is immediately rejected with `400 Bad Request`.

---

## 3. Directory Traversal & Storage Isolation

To prevent arbitrary file overwrite or unauthorized file deletion:

```typescript
// Prevent path traversal
if (storagePath.includes('..')) {
  throw new BadRequestException('Security violation: Path traversal detected');
}

const normalizedStorageKey = path.normalize(storagePath).replace(/^(\/|\\)+/, '');
const absoluteTarget = path.resolve(this.baseStorageDir, normalizedStorageKey);

const relative = path.relative(this.baseStorageDir, absoluteTarget);
if (relative.startsWith('..') || path.isAbsolute(relative)) {
  throw new BadRequestException('Security violation: Path traversal detected');
}
```

- In `LocalStorageProvider`, files are placed strictly inside `./storage/restaurants/<restaurantId>/`.
- In `CloudinaryStorageProvider`, public identifiers are prefixed with `restaurants/<restaurantId>/`.

---

## 4. Tenant Ownership Enforced on Deletion

A restaurant manager cannot delete media assets belonging to another restaurant tenant:

```typescript
async deleteMedia(restaurantId: string, storageKey: string): Promise<void> {
  const rId = TenantHelper.toObjectId(restaurantId).toString();
  const expectedPrefix = `restaurants/${rId}/`;

  if (!storageKey.startsWith(expectedPrefix)) {
    throw new ForbiddenException(
      'Access denied: You cannot delete media assets belonging to another restaurant',
    );
  }

  await this.storageProvider.deleteFile(storageKey);
}
```

---

## 5. Historical Order Auditing & Immutable Item Snapshots

When a restaurant updates dish details or replaces an image:

1. **No Accidental Deletion:**
   Replacing a dish image or 3D model does not delete previously stored files, ensuring previous orders referencing that asset continue to render without broken media links.
2. **Order Item Snapshots:**
   Orders do not dynamically join dish prices or names from the `menu_items` collection. When an order is placed, an immutable `OrderItemSnapshot` is stored directly on the order document:
   ```typescript
   export class OrderItemSnapshot {
     menuItemId: Types.ObjectId;
     name: string;
     unitPrice: number;
     quantity: number;
     subtotal: number;
     specialInstructions?: string;
   }
   ```
3. **Soft-Archiving of Dishes:**
   If a restaurant attempts to delete a dish that has been referenced in one or more historical orders:
   ```typescript
   const historicalOrdersCount = await this.orderModel.countDocuments({
     'items.menuItemId': mId,
   });

   if (historicalOrdersCount > 0) {
     item.publicationStatus = MenuItemPublicationStatus.ARCHIVED;
     item.availabilityStatus = AvailabilityStatus.OUT_OF_STOCK;
     await item.save();
   }
   ```
   The dish is safely archived rather than destructively purged, guaranteeing financial reporting consistency and data integrity.
