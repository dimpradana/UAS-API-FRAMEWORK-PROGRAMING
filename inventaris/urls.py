# inventaris/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # contoh route sederhana
    path('', views.BarangListView.as_view(), name='barang-list'),
]
