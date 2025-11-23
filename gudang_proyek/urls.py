"""gudang_proyek URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.authtoken.views import obtain_auth_token

# Impor untuk dokumentasi API Swagger/Redoc
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    # Admin Django
    path('admin/', admin.site.urls),
    
    
    # URL untuk Web Views Aplikasi Inventaris (CBV)
    path('inventaris/', include('inventaris.urls')),
    
    # URL untuk API Aplikasi Inventaris
    path('api/', include('inventaris.api_urls')),
    
    # URL untuk Mendapatkan Token Autentikasi
    path('api/auth/token/', obtain_auth_token, name='api-token-auth'),
    
    # URL untuk Dokumentasi API
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),  # Generate schema OpenAPI
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),  # Swagger UI
    path('api/docs/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),  # Redoc UI
]