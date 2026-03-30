[English](./README.md) | 中文

# 示例

本目录包含由 `openapi2cli` 生成的完整 CLI 项目。

## github-cli

针对 [GitHub REST API](https://docs.github.com/en/rest) 精选子集生成的 CLI，同时用作 openapi2cli 的集成测试示例。

```bash
cd github-cli
npm install && npm run build

# 查询仓库信息
node dist/index.js repos get-repo --owner octocat --repo Hello-World

# 列出开放的 Issues
node dist/index.js repos list-repo-issues --owner octocat --repo Hello-World --state open

# 查询用户信息
node dist/index.js users get-user --username octocat
```

需要认证时，设置 `API_TOKEN` 环境变量：

```bash
export API_TOKEN=ghp_your_personal_access_token
```
