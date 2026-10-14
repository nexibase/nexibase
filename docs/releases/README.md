# Publishing release notes

Versioned files in this directory are standalone documents. Keep their first `# vX.Y.Z — Title` heading, followed by a blank line, for reading in the repository.

GitHub displays the release name above the release body. Put the version and title in the release name only, and publish the document starting at line 3 as the body. Do not pass the complete versioned Markdown file directly to `--notes-file`.

```sh
tail -n +3 docs/releases/vX.Y.Z.md > /tmp/nexibase-release-body.md
gh release create vX.Y.Z --verify-tag --title "vX.Y.Z — Title" --notes-file /tmp/nexibase-release-body.md
```

For an existing release, use `gh release edit` with the same body file. Verify that the release name remains unchanged and the body starts with the summary or changes, without a repeated version/title heading. Apply the same convention to related plugin releases.

저장소의 릴리즈 문서는 제목을 유지합니다. GitHub 릴리즈에서는 상단 제목과 본문이 중복되지 않도록 첫 제목과 빈 줄을 제외하고 본문을 게시합니다.
