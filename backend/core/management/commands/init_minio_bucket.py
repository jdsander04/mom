"""
Management command to initialize MinIO bucket for media storage.
This ensures the bucket exists and is properly configured.
"""
from django.core.management.base import BaseCommand
from django.conf import settings
import boto3
from botocore.exceptions import ClientError
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Initialize MinIO bucket for media storage'

    def handle(self, *args, **options):
        minio_enabled = getattr(settings, 'MINIO_ENABLED', False)
        
        if not minio_enabled:
            self.stdout.write(self.style.WARNING('MinIO is not enabled. Skipping bucket initialization.'))
            return
        
        try:
            s3_client = boto3.client(
                's3',
                endpoint_url=getattr(settings, 'AWS_S3_ENDPOINT_URL', 'http://minio:9000'),
                aws_access_key_id=getattr(settings, 'AWS_ACCESS_KEY_ID', ''),
                aws_secret_access_key=getattr(settings, 'AWS_SECRET_ACCESS_KEY', ''),
                region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'us-east-1'),
                config=boto3.session.Config(signature_version=getattr(settings, 'AWS_S3_SIGNATURE_VERSION', 's3v4'))
            )
            
            bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'media')
            
            # Check if bucket exists
            try:
                s3_client.head_bucket(Bucket=bucket_name)
                self.stdout.write(self.style.SUCCESS(f'Bucket "{bucket_name}" already exists.'))
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', '')
                if error_code == '404':
                    # Bucket doesn't exist, create it
                    self.stdout.write(f'Creating bucket "{bucket_name}"...')
                    try:
                        s3_client.create_bucket(Bucket=bucket_name)
                        self.stdout.write(self.style.SUCCESS(f'Successfully created bucket "{bucket_name}".'))
                    except ClientError as create_error:
                        self.stdout.write(self.style.ERROR(f'Error creating bucket: {create_error}'))
                        return
                else:
                    self.stdout.write(self.style.ERROR(f'Error checking bucket: {e}'))
                    return
            
            # Set bucket policy for public read access (if needed)
            default_acl = getattr(settings, 'AWS_DEFAULT_ACL', 'public-read')
            if default_acl == 'public-read':
                try:
                    import json
                    # Set bucket policy to allow public read access
                    bucket_policy = {
                        "Version": "2012-10-17",
                        "Statement": [
                            {
                                "Effect": "Allow",
                                "Principal": {"AWS": "*"},
                                "Action": ["s3:GetObject"],
                                "Resource": [f"arn:aws:s3:::{bucket_name}/*"]
                            }
                        ]
                    }
                    s3_client.put_bucket_policy(
                        Bucket=bucket_name,
                        Policy=json.dumps(bucket_policy)
                    )
                    self.stdout.write(self.style.SUCCESS(f'Set public-read policy on bucket "{bucket_name}".'))
                except ClientError as policy_error:
                    self.stdout.write(self.style.WARNING(f'Could not set bucket policy: {policy_error}'))
                    self.stdout.write(self.style.WARNING('You may need to set the bucket policy manually through MinIO console.'))
            
            self.stdout.write(self.style.SUCCESS('MinIO bucket initialization completed successfully.'))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error initializing MinIO bucket: {e}'))
            logger.error(f'Error initializing MinIO bucket: {e}', exc_info=True)

