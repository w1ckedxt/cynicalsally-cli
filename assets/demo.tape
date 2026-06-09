# vhs tape — README demo GIF
# Run from repo root: vhs assets/demo.tape
# One real quick roast (uses 1 QR) + --share, ends on the public card link.

Output assets/demo.gif

Set Shell zsh
Set FontSize 15
Set Width 1100
Set Height 720
Set Padding 16
Set TypingSpeed 45ms
Set Theme "Builtin Dark"

Hide
Type "alias sally='node dist/index.js' && clear"
Enter
Show

Type "sally roast src/utils/card.ts --share"
Sleep 600ms
Enter

Wait@120s
Sleep 5s
