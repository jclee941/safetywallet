import { describe, it, expect } from "vitest";

describe("UI Components barrel exports", () => {
  it("should export all UI components from index", async () => {
    const ui = await import("../index");

    // Button
    expect(ui.Button).toBeDefined();
    expect(ui.buttonVariants).toBeDefined();

    // Card
    expect(ui.Card).toBeDefined();
    expect(ui.CardHeader).toBeDefined();
    expect(ui.CardFooter).toBeDefined();
    expect(ui.CardTitle).toBeDefined();
    expect(ui.CardDescription).toBeDefined();
    expect(ui.CardContent).toBeDefined();

    // Input
    expect(ui.Input).toBeDefined();

    // Badge
    expect(ui.Badge).toBeDefined();
    expect(ui.badgeVariants).toBeDefined();

    // Skeleton
    expect(ui.Skeleton).toBeDefined();

    // Avatar
    expect(ui.Avatar).toBeDefined();
    expect(ui.AvatarImage).toBeDefined();
    expect(ui.AvatarFallback).toBeDefined();

    // Toast
    expect(ui.ToastProvider).toBeDefined();
    expect(ui.ToastViewport).toBeDefined();
    expect(ui.Toast).toBeDefined();
    expect(ui.ToastTitle).toBeDefined();
    expect(ui.ToastDescription).toBeDefined();
    expect(ui.ToastClose).toBeDefined();
    expect(ui.ToastAction).toBeDefined();
    expect(ui.useToast).toBeDefined();
    expect(ui.toast).toBeDefined();
    expect(ui.Toaster).toBeDefined();

    // AlertDialog
    expect(ui.AlertDialog).toBeDefined();
    expect(ui.AlertDialogPortal).toBeDefined();
    expect(ui.AlertDialogOverlay).toBeDefined();
    expect(ui.AlertDialogTrigger).toBeDefined();
    expect(ui.AlertDialogContent).toBeDefined();
    expect(ui.AlertDialogHeader).toBeDefined();
    expect(ui.AlertDialogFooter).toBeDefined();
    expect(ui.AlertDialogTitle).toBeDefined();
    expect(ui.AlertDialogDescription).toBeDefined();
    expect(ui.AlertDialogAction).toBeDefined();
    expect(ui.AlertDialogCancel).toBeDefined();

    // Dialog
    expect(ui.Dialog).toBeDefined();
    expect(ui.DialogPortal).toBeDefined();
    expect(ui.DialogOverlay).toBeDefined();
    expect(ui.DialogClose).toBeDefined();
    expect(ui.DialogTrigger).toBeDefined();
    expect(ui.DialogContent).toBeDefined();
    expect(ui.DialogHeader).toBeDefined();
    expect(ui.DialogFooter).toBeDefined();
    expect(ui.DialogTitle).toBeDefined();
    expect(ui.DialogDescription).toBeDefined();

    // Select
    expect(ui.Select).toBeDefined();
    expect(ui.SelectGroup).toBeDefined();
    expect(ui.SelectValue).toBeDefined();
    expect(ui.SelectTrigger).toBeDefined();
    expect(ui.SelectContent).toBeDefined();
    expect(ui.SelectLabel).toBeDefined();
    expect(ui.SelectItem).toBeDefined();
    expect(ui.SelectSeparator).toBeDefined();
    expect(ui.SelectScrollUpButton).toBeDefined();
    expect(ui.SelectScrollDownButton).toBeDefined();

    // Switch
    expect(ui.Switch).toBeDefined();

    // Sheet
    expect(ui.Sheet).toBeDefined();
    expect(ui.SheetPortal).toBeDefined();
    expect(ui.SheetOverlay).toBeDefined();
    expect(ui.SheetTrigger).toBeDefined();
    expect(ui.SheetClose).toBeDefined();
    expect(ui.SheetContent).toBeDefined();
    expect(ui.SheetHeader).toBeDefined();
    expect(ui.SheetFooter).toBeDefined();
    expect(ui.SheetTitle).toBeDefined();
    expect(ui.SheetDescription).toBeDefined();

    // ErrorBoundary
    expect(ui.ErrorBoundary).toBeDefined();

    // cn utility
    expect(ui.cn).toBeDefined();
  }, 20000);
});
