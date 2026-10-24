# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Cờ tính năng: giao diện tối

Giao diện tối đang **tạm tắt** nhưng code vẫn còn nguyên (token `.dark`, `theme-curtain`, chế độ đêm của cảnh 3D).

- Cờ: `FLAGS.darkMode` trong `src/lib/perf.ts` (đang `false`) và `DARK_MODE` trong script ở `index.html`. Hai chỗ phải cùng giá trị.
- Khi `false`: ẩn mọi nút sáng/tối, luôn bỏ class `dark` trên `<html>`, bỏ qua theme đã lưu, cảnh 3D luôn ban ngày.
- Bật lại: đổi cả hai thành `true`.
