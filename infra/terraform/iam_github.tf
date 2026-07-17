# GitHub Actions OIDC — no long-lived AWS access keys in CI.
data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

data "aws_iam_policy_document" "github_deploy_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Repo-scoped wildcard: covers branch pushes (ref:...), GitHub Environments
    # (environment:...), and other job contexts. Still limited to THIS repo only.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:*"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "${local.name_prefix}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_deploy_trust.json
}

data "aws_iam_policy_document" "github_deploy_permissions" {
  statement {
    sid    = "UploadReleaseArtifacts"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:AbortMultipartUpload",
    ]
    resources = ["${aws_s3_bucket.artifacts.arn}/releases/*"]
  }

  statement {
    sid       = "ListArtifactBucket"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.artifacts.arn]
  }

  statement {
    sid       = "RefreshASG"
    effect    = "Allow"
    actions   = ["autoscaling:StartInstanceRefresh"]
    resources = [aws_autoscaling_group.app.arn]
  }

  statement {
    sid       = "DescribeASG"
    effect    = "Allow"
    actions   = ["autoscaling:DescribeInstanceRefreshes", "autoscaling:DescribeAutoScalingGroups"]
    resources = ["*"]
  }
}

# Note: Describe* ASG APIs do not support resource-level ARNs; scoped StartInstanceRefresh is on the ASG ARN above.
resource "aws_iam_role_policy" "github_deploy" {
  name   = "${local.name_prefix}-github-deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy_permissions.json
}
